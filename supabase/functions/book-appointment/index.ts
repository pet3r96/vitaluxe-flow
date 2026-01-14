import { corsHeaders } from '../_shared/cors.ts';
import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { bookAppointmentSchema, validateInput } from '../_shared/zodSchemas.ts';
import { generateNotificationEmailHTML, generateNotificationEmailText } from '../_shared/emailTemplates.ts';
import { sendNotificationSms } from '../_shared/notificationSmsSender.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';

// Helper: Add +1 prefix ONLY for SMS sending to Twilio (not for storage)
const normalizePhoneToE164 = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 ? `+1${cleaned}` : phone;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const ipAddress = getClientIP(req);

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // PHASE 3: Rate limiting (20 requests/hour)
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      ipAddress,
      'book-appointment',
      { maxRequests: 20, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { function: 'book-appointment', ipAddress });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for active impersonation session
    const { data: impersonationSession } = await supabaseClient
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    const effectiveUserId = impersonationSession?.impersonated_user_id || user.id;

    // Validate input with Zod schema
    const body = await req.json();
    const validation = validateInput(bookAppointmentSchema, body);
    
    if (!validation.success) {
      throw new Error(`Invalid input: ${validation.errors.join(', ')}`);
    }

    const { providerId, appointmentDate, appointmentTime, clientDateTimeIso, timezoneOffsetMinutes, reasonForVisit, visitType, notes } = validation.data;
    edgeLogger.info('Book appointment request', { providerId, appointmentDate, appointmentTime, visitType });

    // Get patient's assigned practice from patient_accounts using effective user ID
    const { data: patientAccount, error: patientError } = await supabaseClient
      .from('patient_accounts')
      .select('practice_id, id')
      .eq('user_id', effectiveUserId)
      .single();

    if (patientError || !patientAccount) {
      throw new Error('Patient account not found. Please contact your healthcare provider.');
    }

    // PHASE 3: ID validation (verify practice access)
    const { valid: ownsResource, error: idError } = await validateUserOwnsResource(
      supabaseAdmin,
      user.id,
      'practice',
      patientAccount.practice_id
    );

    if (!ownsResource) {
      edgeLogger.error('ID validation failed', undefined, { error: idError, userId: user.id, practiceId: patientAccount.practice_id });
      throw new Error(idError || 'Access denied to this practice');
    }

    // Use clientDateTimeIso if provided (client-side timezone), otherwise fallback to server-side construction
    const fullDateTime = clientDateTimeIso ? new Date(clientDateTimeIso) : new Date(`${appointmentDate}T${appointmentTime}`);
    const endDateTime = new Date(fullDateTime.getTime() + 60 * 60 * 1000); // +1 hour default

    // Validation 1: Check if date is in the past
    if (fullDateTime <= new Date()) {
      throw new Error('Cannot book appointments in the past');
    }
    
    // Validation 1b: Check if appointment end time exceeds practice hours
    const appointmentEndTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;

    // Validation 2: Check if practice is open on this day (using RPC with defaults)
    const dayOfWeek = fullDateTime.getDay();
    const { data: hours, error: hoursError } = await supabaseClient
      .rpc('get_practice_hours_with_defaults', {
        p_practice_id: patientAccount.practice_id,
        p_day_of_week: dayOfWeek
      });

    if (hoursError) throw hoursError;

    const practiceHours = hours?.[0];
    if (!practiceHours || practiceHours.is_closed) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      throw new Error(`Practice is closed on ${dayNames[dayOfWeek]}s`);
    }

    // Validation 3: Check if time is within business hours
    // Normalize time formats for comparison (HH:MM vs HH:MM:SS)
    const normalizeTime = (time: string) => {
      const parts = time.split(':');
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    };
    
    const startTimeStr = practiceHours.start_time.toString();
    const endTimeStr = practiceHours.end_time.toString();
    const appointmentTimeNorm = normalizeTime(appointmentTime);
    const appointmentEndTimeNorm = normalizeTime(appointmentEndTime);
    const startTimeNorm = normalizeTime(startTimeStr);
    const endTimeNorm = normalizeTime(endTimeStr);
    
    if (appointmentTimeNorm < startTimeNorm) {
      // Format for user-friendly display
      const formatTime = (time: string) => {
        const [h, m] = time.split(':');
        const hour = parseInt(h);
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        return `${displayHour}:${m} ${ampm}`;
      };
      throw new Error(`Practice hours start at ${formatTime(startTimeStr)}`);
    }
    
    if (appointmentEndTimeNorm > endTimeNorm) {
      const formatTime = (time: string) => {
        const [h, m] = time.split(':');
        const hour = parseInt(h);
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        return `${displayHour}:${m} ${ampm}`;
      };
      throw new Error(`Appointment would end after practice closes at ${formatTime(endTimeStr)}`);
    }

    // Validation 4: Check if time is blocked
    const { data: blocked, error: blockedError } = await supabaseClient
      .from('practice_blocked_time')
      .select('reason')
      .eq('practice_id', patientAccount.practice_id)
      .lte('start_time', fullDateTime.toISOString())
      .gte('end_time', fullDateTime.toISOString())
      .maybeSingle();

    if (blockedError) throw blockedError;
    if (blocked) {
      throw new Error(`This time slot is blocked${blocked.reason ? ': ' + blocked.reason : ''}`);
    }

    // Validation 5: Check for appointment conflicts
    const { data: conflicts, error: conflictError } = await supabaseClient
      .from('patient_appointments')
      .select('id')
      .eq('practice_id', patientAccount.practice_id)
      .not('status', 'in', '(cancelled,no_show)')
      .lt('start_time', endDateTime.toISOString())
      .gt('end_time', fullDateTime.toISOString());

    if (conflictError) throw conflictError;
    if (conflicts && conflicts.length > 0) {
      throw new Error('This time slot is already booked. Please choose another time.');
    }

    const { data, error } = await supabaseClient
      .from('patient_appointments')
      .insert({
        patient_id: patientAccount.id,
        practice_id: patientAccount.practice_id,
        provider_id: providerId || null,
        appointment_type: 'patient_request',
        start_time: fullDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        reason_for_visit: reasonForVisit,
        visit_type: visitType || 'in_person',
        status: 'pending',
        confirmation_type: 'pending',
        requested_date: appointmentDate,
        requested_time: appointmentTime,
        notes,
      })
      .select()
      .single();

    if (error) throw error;

    // Send notification to patient
    edgeLogger.info('Sending notification for appointment', { appointmentId: data.id });
    
    const { data: patientWithUser, error: patientUserError } = await supabaseClient
      .from('patient_accounts')
      .select('user_id, first_name, last_name, email, phone, practice_id')
      .eq('id', data.patient_id)
      .single();

    if (patientUserError) {
      edgeLogger.error('Error fetching patient user data', patientUserError);
    } else if (patientWithUser) {
      const patientName = `${patientWithUser.first_name || ''} ${patientWithUser.last_name || ''}`.trim() || 'Patient';
      const appointmentDateFormatted = new Date(data.start_time).toLocaleDateString();
      const appointmentTimeFormatted = new Date(data.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Fetch practice address
      const { data: practice, error: practiceError } = await supabaseClient
        .from('profiles')
        .select('address_street, address_city, address_state, address_zip')
        .eq('id', patientWithUser.practice_id)
        .single();
      
      if (practiceError) {
        edgeLogger.error('Error fetching practice address', practiceError);
      }
      
      // Note: Video appointments coming soon - currently only in_person is supported
      
      if (patientWithUser.user_id) {
        // Patient has portal access - use handleNotifications
        edgeLogger.info('[book-appointment] Patient has portal access, calling handleNotifications');
        try {
          const address = practice 
            ? `${practice.address_street}, ${practice.address_city}, ${practice.address_state} ${practice.address_zip}`
            : '';
          const message = `Your appointment request for an in-office appointment on ${appointmentDateFormatted} at ${appointmentTimeFormatted}${address ? ` at ${address}` : ''} has been submitted and is pending approval.`;
          
          await supabaseClient.functions.invoke('handleNotifications', {
            body: {
              user_id: patientWithUser.user_id,
              notification_type: 'appointment_booked',
              title: 'Appointment Requested',
              message,
              metadata: {
                appointmentId: data.id,
                appointmentDate: appointmentDateFormatted,
                appointmentTime: appointmentTimeFormatted,
                visitType: visitType
              }
            }
          });
          edgeLogger.info('Notification sent via handleNotifications');
        } catch (notifError) {
          edgeLogger.error('Error calling handleNotifications', notifError);
        }
      } else {
        // No portal access - send email/SMS directly
        edgeLogger.info('Patient has no portal access, sending direct email/SMS');
        
        const address = practice 
          ? `${practice.address_street}, ${practice.address_city}, ${practice.address_state} ${practice.address_zip}`
          : '';
        const directMessage = `Your appointment request for an in-office appointment on ${appointmentDateFormatted} at ${appointmentTimeFormatted}${address ? ` at ${address}` : ''} has been submitted and is pending approval.`;
        
        if (patientWithUser.email) {
          try {
            const htmlBody = generateNotificationEmailHTML({
              recipientName: patientName,
              title: 'Appointment Requested',
              message: directMessage,
              actionUrl: undefined,
              senderContext: { fromName: 'Your Healthcare Provider' }
            });
            const textBody = generateNotificationEmailText({
              recipientName: patientName,
              title: 'Appointment Requested',
              message: directMessage,
              actionUrl: undefined,
              senderContext: { fromName: 'Your Healthcare Provider' }
            });
            
            await supabaseClient.functions.invoke('unified-email-sender', {
              body: {
                type: 'notification',
                to: patientWithUser.email,
                subject: 'Appointment Requested',
                htmlBody,
                textBody,
                userId: patientWithUser.user_id,
                eventType: 'appointment_confirmation'
              }
            });
            edgeLogger.info('Email sent to patient', { emailDomain: patientWithUser.email?.split('@')[1] });
          } catch (emailError) {
            edgeLogger.error('Error sending email', emailError);
          }
        }
        
        if (patientWithUser.phone) {
          try {
            const normalizedPhone = normalizePhoneToE164(patientWithUser.phone);
            const smsMessage = `In-office appointment request for ${appointmentDateFormatted} at ${appointmentTimeFormatted}${practice ? ` at ${practice.address_city}, ${practice.address_state}` : ''}. Pending approval.`;
            
            await sendNotificationSms({
              phoneNumber: normalizedPhone,
              message: smsMessage,
              metadata: { appointmentId: data.id }
            });
            edgeLogger.info('[book-appointment] SMS sent', { phonePrefix: normalizedPhone.substring(0, 5) });
          } catch (smsError) {
            edgeLogger.error('[book-appointment] Error sending SMS', smsError);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, appointment: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    edgeLogger.error('[book-appointment] Error occurred', error, { stack: errorStack });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
