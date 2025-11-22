import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { edgeLogger } from '../_shared/logger.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();

    // Authenticate user
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { patientId, providerId, practiceId } = await req.json();

    if (!patientId || !providerId || !practiceId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: patientId, providerId, practiceId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== VALIDATE IDs ==========
    // Validate patient exists and belongs to practice
    const { data: patientCheck, error: patientError } = await supabase
      .from('patient_accounts')
      .select('id, practice_id')
      .eq('id', patientId)
      .eq('practice_id', practiceId)
      .single();

    if (patientError || !patientCheck) {
      return new Response(
        JSON.stringify({ error: 'Invalid patient or patient does not belong to practice' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate provider exists and belongs to practice
    const { data: providerCheck, error: providerError } = await supabase
      .from('providers')
      .select('id, practice_id')
      .eq('id', providerId)
      .eq('practice_id', practiceId)
      .single();

    if (providerError || !providerCheck) {
      return new Response(
        JSON.stringify({ error: 'Invalid provider or provider does not belong to practice' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate practice exists
    const { data: practiceCheck, error: practiceError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', practiceId)
      .single();

    if (practiceError || !practiceCheck) {
      return new Response(
        JSON.stringify({ error: 'Invalid practice' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('[create-instant-video-session] ID validation passed');
    // ========== END VALIDATION ==========

    // ========== CREATE APPOINTMENT ==========
    const now = new Date();
    const scheduledTime = new Date(now.getTime() + 60_000);
    const endTime = new Date(scheduledTime.getTime() + 30 * 60_000);

    edgeLogger.info('[create-instant-video-session] Creating appointment', {
      patient_id: patientId,
      provider_id: providerId,
      practice_id: practiceId,
    });

    const { data: appointment, error: appointmentError } = await supabase
      .from('patient_appointments')
      .insert({
        patient_id: patientId,
        provider_id: providerId,
        practice_id: practiceId,
        start_time: scheduledTime.toISOString(),
        end_time: endTime.toISOString(),
        visit_type: 'video',
        appointment_type: 'consultation',
        status: 'confirmed',
        reason_for_visit: 'Instant Video Consultation',
        notes: 'Created instantly by provider/staff',
      })
      .select()
      .single();

    if (appointmentError || !appointment) {
      edgeLogger.error('[create-instant-video-session] Appointment creation failed', appointmentError);
      return new Response(
        JSON.stringify({ error: 'Failed to create appointment', details: appointmentError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== CREATE VIDEO SESSION DIRECTLY (NO TRIGGER) ==========
    let channelName: string;
    let attempts = 0;
    const maxAttempts = 3;

    do {
      channelName = `vlx_instant_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const { data: existing } = await supabase
        .from('video_sessions')
        .select('id')
        .eq('channel_name', channelName)
        .maybeSingle();
      
      if (!existing) break;
      
      attempts++;
      edgeLogger.warn('[create-instant-video-session] Channel collision, retrying', { attempt: attempts });
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      edgeLogger.error('[create-instant-video-session] Failed to generate unique channel name');
      return new Response(
        JSON.stringify({ error: 'Failed to generate unique channel name' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: videoSession, error: sessionError } = await supabase
      .from('video_sessions')
      .insert({
        appointment_id: appointment.id,
        patient_id: patientId,
        provider_id: providerId,
        practice_id: practiceId,
        channel_name: channelName,
        session_type: 'instant',
        status: 'live',
        actual_start: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionError || !videoSession) {
      edgeLogger.error('[create-instant-video-session] Video session creation failed', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create video session', details: sessionError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('[create-instant-video-session] Video session created', { 
      sessionId: videoSession.id,
      channelName 
    });
    // ========== END SESSION CREATION ==========

    // Send instant video notification to patient
    edgeLogger.info('[create-instant-video-session] Sending notification for instant video session');
    
    const { data: patientWithUser, error: patientUserError } = await supabase
      .from('patient_accounts')
      .select('user_id, first_name, last_name, email, phone')
      .eq('id', patientId)
      .single();

    if (patientUserError) {
      edgeLogger.error('[create-instant-video-session] Error fetching patient user data', patientUserError);
    } else if (patientWithUser) {
      const patientName = `${patientWithUser.first_name || ''} ${patientWithUser.last_name || ''}`.trim() || 'Patient';
      
      // Format time in America/New_York timezone (EST/EDT)
      const appointmentDateFormatted = new Date(appointment.start_time).toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      const appointmentTimeFormatted = new Date(appointment.start_time).toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      if (patientWithUser.user_id) {
        // Patient has portal access - use handleNotifications
        edgeLogger.info('[create-instant-video-session] Patient has portal access, calling handleNotifications');
        try {
          await supabase.functions.invoke('handleNotifications', {
            body: {
              user_id: patientWithUser.user_id,
              type: 'video_session_started',
              title: 'Video Session Ready',
              message: `Your instant video session is ready to join.`,
              metadata: {
                appointmentId: appointment.id,
                sessionId: videoSession.id,
                appointmentDate: appointmentDateFormatted,
                appointmentTime: appointmentTimeFormatted
              }
            }
          });
          edgeLogger.info('[create-instant-video-session] Notification sent via handleNotifications');
        } catch (notifError) {
          edgeLogger.error('[create-instant-video-session] Error calling handleNotifications', notifError);
        }
      } else {
        // No portal access - send email/SMS directly
        edgeLogger.info('[create-instant-video-session] Patient has no portal access, sending direct email/SMS');
        
        const { sendNotificationEmail } = await import('../_shared/notificationEmailSender.ts');
        const { sendNotificationSms } = await import('../_shared/notificationSmsSender.ts');
        
        if (patientWithUser.email) {
          try {
            await sendNotificationEmail({
              to: patientWithUser.email,
              recipientName: patientName,
              subject: 'Video Session Ready',
              title: 'Video Session Ready',
              message: `Your instant video session is ready to join.`,
              actionUrl: undefined,
              senderContext: { fromName: 'Your Healthcare Provider' }
            });
            edgeLogger.info('[create-instant-video-session] Email sent');
          } catch (emailError) {
            edgeLogger.error('[create-instant-video-session] Error sending email', emailError);
          }
        }
        
        if (patientWithUser.phone) {
          try {
            // Add +1 prefix ONLY for SMS sending to Twilio (not for storage)
            const normalizePhoneToE164 = (phone: string): string => {
              const cleaned = phone.replace(/\D/g, '');
              return cleaned.length === 10 ? `+1${cleaned}` : phone;
            };
            const normalizedPhone = normalizePhoneToE164(patientWithUser.phone);
            await sendNotificationSms({
              phoneNumber: normalizedPhone,
              message: `Your instant video session is ready to join.`,
              metadata: { appointmentId: appointment.id, sessionId: videoSession.id }
            });
            edgeLogger.info('[create-instant-video-session] SMS sent');
          } catch (smsError) {
            edgeLogger.error('[create-instant-video-session] Error sending SMS', smsError);
          }
        }
      }
    }

    // Return the session. Frontend will start the session (ensures proper user authorization)
    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionId: videoSession.id, 
        appointmentId: appointment.id,
        channelName: channelName 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    edgeLogger.error('Error in create-instant-video-session', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
