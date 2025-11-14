import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { generateNotificationEmailHTML, generateNotificationEmailText } from '../_shared/emailTemplates.ts';
import { sendNotificationSms } from '../_shared/notificationSmsSender.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

const normalizePhoneToE164 = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  return phone;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    // Service role client for operations that need to bypass RLS
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabaseAdmin, user.id, csrfToken);
    if (!valid) {
      console.error('CSRF validation failed:', csrfError);
      return errorResponse(csrfError || 'Invalid CSRF token', 403);
    }

    const { appointmentId } = await req.json();
    console.log('🔍 [cancel-appointment] Starting cancellation:', { appointmentId, authUserId: user.id });

    // Check for active impersonation session
    let effectiveUserId = user.id;
    const { data: impersonationSession, error: impersonationError } = await supabaseClient
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (impersonationError) {
      console.warn('⚠️ [cancel-appointment] Impersonation check failed (continuing as normal user):', impersonationError.message);
    } else if (impersonationSession?.impersonated_user_id) {
      effectiveUserId = impersonationSession.impersonated_user_id;
      console.log('👥 [cancel-appointment] Impersonation detected:', { 
        adminUserId: user.id, 
        effectiveUserId 
      });
    }

    console.log('✅ [cancel-appointment] Using effective user ID:', effectiveUserId);

    // Check if user is a patient (use admin client to bypass RLS)
    const { data: patientAccount } = await supabaseAdmin
      .from('patient_accounts')
      .select('id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    // Check if user is a provider (use admin client to bypass RLS)
    const { data: providerAccount } = await supabaseAdmin
      .from('providers')
      .select('id, practice_id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    // Check if user is staff (use admin client to bypass RLS)
    const { data: staffAccount } = await supabaseAdmin
      .from('practice_staff')
      .select('id, practice_id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    console.log('👤 [cancel-appointment] User role lookup:', { 
      effectiveUserId,
      isPatient: !!patientAccount,
      isProvider: !!providerAccount,
      isStaff: !!staffAccount
    });

    let appointment;
    let fetchError;

    if (patientAccount) {
      // Patient cancelling their own appointment
      const result = await supabaseAdmin
        .from('patient_appointments')
        .select('id, patient_id, status, practice_id')
        .eq('id', appointmentId)
        .eq('patient_id', patientAccount.id)
        .maybeSingle();
      
      appointment = result.data;
      fetchError = result.error;
    } else if (providerAccount || staffAccount) {
      // Provider/staff cancelling any appointment in their practice
      const practiceId = providerAccount?.practice_id || staffAccount?.practice_id;
      
      const result = await supabaseAdmin
        .from('patient_appointments')
        .select('id, patient_id, status, practice_id')
        .eq('id', appointmentId)
        .eq('practice_id', practiceId)
        .maybeSingle();
      
      appointment = result.data;
      fetchError = result.error;
    } else {
      // Check if effectiveUserId is a practice itself (stored in profiles table)
      // Practice admins can cancel any appointment in their practice
      const result = await supabaseAdmin
        .from('patient_appointments')
        .select('id, patient_id, status, practice_id')
        .eq('id', appointmentId)
        .eq('practice_id', effectiveUserId)
        .maybeSingle();
      
      appointment = result.data;
      fetchError = result.error;

      if (!appointment) {
        console.error('❌ [cancel-appointment] User has no valid role and is not the practice owner');
        throw new Error('Unauthorized: User does not have permission to cancel appointments');
      }

      console.log('✅ [cancel-appointment] Practice admin cancelling appointment');
    }

    console.log('📅 [cancel-appointment] Appointment verification:', { 
      appointmentId,
      found: !!appointment,
      currentStatus: appointment?.status,
      belongsToPatient: patientAccount ? appointment?.patient_id === patientAccount.id : false,
      fetchError: fetchError?.message 
    });

    // Handle idempotent cases
    if (fetchError) {
      console.error('❌ [cancel-appointment] Appointment fetch error:', fetchError);
      throw new Error('Appointment fetch failed: ' + fetchError.message);
    }

    if (!appointment) {
      console.log('ℹ️ [cancel-appointment] Appointment not found (may already be cancelled or deleted)');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Appointment already cancelled or not found',
        idempotent: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Track if appointment was already cancelled for idempotent response
    let appointmentWasAlreadyCancelled = false;
    
    // Update appointment status if not already cancelled
    if (appointment.status === 'cancelled') {
      appointmentWasAlreadyCancelled = true;
      console.log('ℹ️ [cancel-appointment] Appointment already cancelled, will check video session');
    } else {
      // Perform the cancellation (use admin client to bypass RLS)
      console.log('✅ [cancel-appointment] Updating appointment status to cancelled');
      const { error } = await supabaseAdmin
        .from('patient_appointments')
        .update({ 
          status: 'cancelled', 
          updated_at: new Date().toISOString(), 
          cancelled_at: new Date().toISOString() 
        })
        .eq('id', appointmentId);

      if (error) {
        console.error('❌ [cancel-appointment] Update error:', error);
        throw error;
      }

      console.log('✅ [cancel-appointment] Appointment cancelled successfully');
    }

    // ALWAYS check and update video session status (even if appointment was already cancelled)
    // This ensures video sessions are synchronized with their appointments
    // Use admin client to bypass RLS since impersonation affects RLS policies
    const { data: videoSession } = await supabaseAdmin
      .from('video_sessions')
      .select('id, status')
      .eq('appointment_id', appointmentId)
      .maybeSingle();

    let videoSessionUpdated = false;
    if (videoSession && videoSession.status !== 'ended') {
      console.log('🎥 [cancel-appointment] Updating video session to ended:', videoSession.id);
      const { error: vsError } = await supabaseAdmin
        .from('video_sessions')
        .update({
          status: 'ended'
        })
        .eq('id', videoSession.id);

      if (vsError) {
        console.error('❌ [cancel-appointment] Video session update error:', vsError);
        throw new Error('Video session update failed: ' + vsError.message);
      }
      // Log the cancellation (use admin client to ensure it persists)
      await supabaseAdmin.from('video_session_logs').insert({
        session_id: videoSession.id,
        event_type: 'session_cancelled',
        user_id: user.id,
        user_type: 'provider',
        event_data: { reason: 'appointment_cancelled' }
      });
      
      videoSessionUpdated = true;
      console.log('✅ [cancel-appointment] Video session also cancelled');
    } else if (videoSession) {
      console.log('ℹ️ [cancel-appointment] Video session already ended');
    }

    console.log(`[cancel-appointment] Successfully cancelled appointment ${appointmentId}${videoSessionUpdated ? ' and ended video session' : ''}`);

    // Send cancellation notification to patient (only if not already cancelled)
    if (!appointmentWasAlreadyCancelled && appointment) {
      console.log('[cancel-appointment] Sending cancellation notification');
      
      const { data: patientWithUser, error: patientUserError } = await supabaseAdmin
        .from('patient_accounts')
        .select('user_id, first_name, last_name, email, phone, id')
        .eq('id', appointment.patient_id)
        .single();

      if (patientUserError) {
        console.error('[cancel-appointment] Error fetching patient user data:', patientUserError);
      } else if (patientWithUser) {
        const patientName = `${patientWithUser.first_name || ''} ${patientWithUser.last_name || ''}`.trim() || 'Patient';
        
        // Get practice details for notification
        const { data: practiceDetails } = await supabaseAdmin
          .from('profiles')
          .select('name, company, address_street, address_city, address_state, address_zip')
          .eq('id', appointment.practice_id)
          .single();

        const practiceName = practiceDetails?.company || practiceDetails?.name || 'Your Healthcare Provider';
        const practiceAddress = practiceDetails?.address_street 
          ? `${practiceDetails.address_street}, ${practiceDetails.address_city}, ${practiceDetails.address_state} ${practiceDetails.address_zip}`
          : '';
        
        // Get appointment details for notification
        const { data: appointmentDetails } = await supabaseAdmin
          .from('patient_appointments')
          .select('start_time, end_time')
          .eq('id', appointmentId)
          .single();
        
        if (appointmentDetails) {
          const appointmentDateFormatted = new Date(appointmentDetails.start_time).toLocaleDateString();
          const appointmentTimeFormatted = new Date(appointmentDetails.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          if (patientWithUser.user_id) {
            // Patient has portal access - use handleNotifications
            console.log('[cancel-appointment] Patient has portal access, calling handleNotifications');
            try {
              await supabaseAdmin.functions.invoke('handleNotifications', {
                body: {
                  user_id: patientWithUser.user_id,
                  type: 'appointment_cancelled',
                  title: 'Appointment Cancelled',
                  message: `Your appointment for ${appointmentDateFormatted} at ${appointmentTimeFormatted} with ${practiceName}${practiceAddress ? ' at ' + practiceAddress : ''} has been cancelled.`,
                  metadata: {
                    appointmentId: appointmentId,
                    appointmentDate: appointmentDateFormatted,
                    appointmentTime: appointmentTimeFormatted,
                    practiceName: practiceName,
                    practiceAddress: practiceAddress
                  }
                }
              });
              console.log('[cancel-appointment] Notification sent via handleNotifications');
            } catch (notifError) {
              console.error('[cancel-appointment] Error calling handleNotifications:', notifError);
            }
          } else {
            // No portal access - send email/SMS directly
            console.log('[cancel-appointment] Patient has no portal access, sending direct email/SMS');
            
            if (patientWithUser.email) {
              try {
                const htmlBody = generateNotificationEmailHTML({
                  recipientName: patientName,
                  title: 'Appointment Cancelled',
                  message: `Your appointment for ${appointmentDateFormatted} at ${appointmentTimeFormatted} with ${practiceName}${practiceAddress ? ' at ' + practiceAddress : ''} has been cancelled.`,
                  actionUrl: undefined,
                  senderContext: { fromName: practiceName }
                });
                const textBody = generateNotificationEmailText({
                  recipientName: patientName,
                  title: 'Appointment Cancelled',
                  message: `Your appointment for ${appointmentDateFormatted} at ${appointmentTimeFormatted} with ${practiceName}${practiceAddress ? ' at ' + practiceAddress : ''} has been cancelled.`,
                  actionUrl: undefined,
                  senderContext: { fromName: practiceName }
                });
                
                await supabaseClient.functions.invoke('unified-email-sender', {
                  body: {
                    type: 'notification',
                    to: patientWithUser.email,
                    subject: 'Appointment Cancelled',
                    htmlBody,
                    textBody,
                    userId: patientWithUser.user_id,
                    eventType: 'appointment_cancellation'
                  }
                });
                console.log('[cancel-appointment] Email sent to:', patientWithUser.email);
              } catch (emailError) {
                console.error('[cancel-appointment] Error sending email:', emailError);
              }
            }
            
            if (patientWithUser.phone) {
              try {
                const normalizedPhone = normalizePhoneToE164(patientWithUser.phone);
                await sendNotificationSms({
                  phoneNumber: normalizedPhone,
                  message: `Your appointment for ${appointmentDateFormatted} at ${appointmentTimeFormatted} with ${practiceName} has been cancelled. ${practiceAddress}`,
                  metadata: { 
                    appointmentId: appointmentId,
                    practiceName: practiceName,
                    practiceAddress: practiceAddress
                  }
                });
                console.log('[cancel-appointment] SMS sent to:', normalizedPhone);
              } catch (smsError) {
                console.error('[cancel-appointment] Error sending SMS:', smsError);
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      idempotent: appointmentWasAlreadyCancelled,
      videoSessionUpdated
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
