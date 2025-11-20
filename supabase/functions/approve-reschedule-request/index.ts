import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { generateNotificationEmailHTML, generateNotificationEmailText } from '../_shared/emailTemplates.ts';
import { sendNotificationSms } from '../_shared/notificationSmsSender.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';

// Helper: Add +1 prefix ONLY for SMS sending to Twilio (not for storage)
const normalizePhoneToE164 = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 ? `+1${cleaned}` : phone;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabaseClient, user.id, csrfToken);
    if (!valid) {
      edgeLogger.error('CSRF validation failed', undefined, { error: csrfError });
      throw new Error(csrfError || 'Invalid CSRF token');
    }

    const { appointmentId, action, ignoreConflicts = true, cancelOriginal = false, requestedDateTimeIso } = await req.json();

    if (!appointmentId || !action) {
      throw new Error('appointmentId and action are required');
    }

    if (!['move', 'duplicate'].includes(action)) {
      throw new Error('action must be "move" or "duplicate"');
    }

    edgeLogger.info('Approve reschedule request', { appointmentId, action, ignoreConflicts, cancelOriginal });

    const supabaseAdmin = createAdminClient();

    // Get user role and verify authorization using roleChecker
    const { requireRole, getUserRoles } = await import('../_shared/roleChecker.ts');
    await requireRole(supabaseClient, user.id, ['admin', 'provider'], 'Only admins and providers can approve reschedule requests');
    
    // Get user roles to check if provider (for access validation)
    const userRoles = await getUserRoles(supabaseClient, user.id);
    const isProvider = userRoles.includes('provider');

    // Fetch the appointment with reschedule request details
    const { data: appointment, error: fetchError } = await supabaseClient
      .from('patient_appointments')
      .select('*, patient_accounts!inner(practice_id)')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      throw new Error('Appointment not found');
    }

    if (!appointment.requested_date || !appointment.requested_time) {
      throw new Error('No reschedule request found for this appointment');
    }

    // Verify user has access to this practice
    const practiceId = appointment.patient_accounts.practice_id;
    
    if (isProvider) {
      const { data: provider } = await supabaseClient
        .from('practice_providers')
        .select('practice_id')
        .eq('user_id', user.id)
        .eq('practice_id', practiceId)
        .single();

      if (!provider) {
        throw new Error('Provider does not have access to this practice');
      }
    }

    // Calculate new start and end times using client timezone if available
    let newStartTime: string;
    
    if (requestedDateTimeIso) {
      // Use the client-provided ISO time (already in correct timezone)
      newStartTime = requestedDateTimeIso;
    } else {
      // Fallback: construct from requested_date and requested_time (may have timezone issues)
      const requestedDateTime = `${appointment.requested_date}T${appointment.requested_time}:00`;
      newStartTime = new Date(requestedDateTime).toISOString();
    }
    
    const duration = new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime();
    const newEndTime = new Date(new Date(newStartTime).getTime() + duration).toISOString();

    edgeLogger.info('Calculated times', { newStartTime, newEndTime, duration });

    // Check for conflicts if not ignoring
    if (!ignoreConflicts) {
      const { data: conflicts } = await supabaseClient
        .from('patient_appointments')
        .select('id')
        .eq('provider_id', appointment.provider_id)
        .neq('status', 'cancelled')
        .neq('status', 'no_show')
        .or(`and(start_time.lt.${newEndTime},end_time.gt.${newStartTime})`)
        .neq('id', appointmentId);

      if (conflicts && conflicts.length > 0) {
        throw new Error('Time slot conflicts with existing appointments');
      }
    }

    if (action === 'move') {
      // Move the existing appointment to the new time
      const { data: updated, error: updateError } = await supabaseClient
        .from('patient_appointments')
        .update({
          start_time: newStartTime,
          end_time: newEndTime,
          status: 'scheduled',
          confirmation_type: 'confirmed',
          requested_date: null,
          requested_time: null,
          reschedule_reason: null,
          reschedule_requested_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .select()
        .single();

      if (updateError) throw updateError;

      edgeLogger.info('Appointment moved successfully', { appointmentId: updated.id });

      // Send rescheduled notification to patient
      edgeLogger.info('Sending reschedule notification');
      const { data: patientWithUser, error: patientUserError } = await supabaseClient
        .from('patient_accounts')
        .select('user_id, first_name, last_name, email, phone')
        .eq('id', appointment.patient_id)
        .single();

      if (patientUserError) {
        edgeLogger.error('Error fetching patient user data', patientUserError);
      } else if (patientWithUser) {
        const patientName = `${patientWithUser.first_name || ''} ${patientWithUser.last_name || ''}`.trim() || 'Patient';
        const appointmentDateFormatted = new Date(updated.start_time).toLocaleDateString();
        const appointmentTimeFormatted = new Date(updated.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (patientWithUser.user_id) {
          try {
            await supabaseClient.functions.invoke('handleNotifications', {
              body: {
                user_id: patientWithUser.user_id,
                type: 'appointment_rescheduled',
                title: 'Appointment Rescheduled',
                message: `Your appointment has been rescheduled to ${appointmentDateFormatted} at ${appointmentTimeFormatted}.`,
                metadata: {
                  appointmentId: updated.id,
                  appointmentDate: appointmentDateFormatted,
                  appointmentTime: appointmentTimeFormatted
                }
              }
            });
            edgeLogger.info('Notification sent via handleNotifications');
          } catch (notifError) {
            edgeLogger.error('Error calling handleNotifications', notifError);
          }
        } else {
          if (patientWithUser.email) {
            try {
              const htmlBody = generateNotificationEmailHTML({
                recipientName: patientName,
                title: 'Appointment Rescheduled',
                message: `Your appointment has been rescheduled to ${appointmentDateFormatted} at ${appointmentTimeFormatted}.`,
                actionUrl: undefined,
                senderContext: { fromName: 'Your Healthcare Provider' }
              });
              const textBody = generateNotificationEmailText({
                recipientName: patientName,
                title: 'Appointment Rescheduled',
                message: `Your appointment has been rescheduled to ${appointmentDateFormatted} at ${appointmentTimeFormatted}.`,
                actionUrl: undefined,
                senderContext: { fromName: 'Your Healthcare Provider' }
              });
              
              await supabaseClient.functions.invoke('unified-email-sender', {
                body: {
                  type: 'notification',
                  to: patientWithUser.email,
                  subject: 'Appointment Rescheduled',
                  htmlBody,
                  textBody,
                  userId: patientWithUser.user_id,
                  eventType: 'appointment_reschedule'
                }
              });
              edgeLogger.info('[approve-reschedule] Email sent', { to: patientWithUser.email });
            } catch (emailError) {
              edgeLogger.error('[approve-reschedule] Error sending email', emailError);
            }
          }
          
          if (patientWithUser.phone) {
            try {
              const normalizedPhone = normalizePhoneToE164(patientWithUser.phone);
              await sendNotificationSms({
                phoneNumber: normalizedPhone,
                message: `Appointment rescheduled to ${appointmentDateFormatted} at ${appointmentTimeFormatted}.`,
                metadata: { appointmentId: updated.id }
              });
              edgeLogger.info('[approve-reschedule] SMS sent', { phonePrefix: normalizedPhone.substring(0, 5) });
            } catch (smsError) {
              edgeLogger.error('[approve-reschedule] Error sending SMS', smsError);
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true, appointment: updated, action: 'moved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Create a new appointment with the requested time
      const { data: newAppointment, error: insertError } = await supabaseClient
        .from('patient_appointments')
        .insert({
          patient_id: appointment.patient_id,
          practice_id: appointment.practice_id,
          provider_id: appointment.provider_id,
          room_id: appointment.room_id,
          start_time: newStartTime,
          end_time: newEndTime,
          appointment_type: appointment.appointment_type,
          service_type_id: appointment.service_type_id,
          service_description: appointment.service_description,
          notes: appointment.notes,
          status: 'scheduled',
          confirmation_type: 'confirmed',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      edgeLogger.info('New appointment created', { appointmentId: newAppointment.id });

      // Clear reschedule request from original appointment
      const { error: clearError } = await supabaseClient
        .from('patient_appointments')
        .update({
          requested_date: null,
          requested_time: null,
          reschedule_reason: null,
          reschedule_requested_at: null,
          status: cancelOriginal ? 'cancelled' : appointment.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (clearError) edgeLogger.error('Error clearing reschedule request', clearError);

      return new Response(JSON.stringify({
        success: true, 
        appointment: newAppointment, 
        action: 'duplicated',
        originalCancelled: cancelOriginal 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    edgeLogger.error('Approve reschedule error', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
