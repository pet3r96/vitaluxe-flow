import { corsHeaders } from '../_shared/cors.ts';
import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { bookAppointmentSchema, validateInput } from '../_shared/zodSchemas.ts';
import { sendNotificationEmail } from '../_shared/notificationEmailSender.ts';
import { sendNotificationSms } from '../_shared/notificationSmsSender.ts';

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

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

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
    console.log('[book-appointment] Request data:', { providerId, appointmentDate, appointmentTime, clientDateTimeIso, reasonForVisit, visitType });

    // Get patient's assigned practice from patient_accounts using effective user ID
    const { data: patientAccount, error: patientError } = await supabaseClient
      .from('patient_accounts')
      .select('practice_id, id')
      .eq('user_id', effectiveUserId)
      .single();

    if (patientError || !patientAccount) {
      throw new Error('Patient account not found. Please contact your healthcare provider.');
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
    console.log('[book-appointment] Sending notification for appointment:', data.id);
    
    const { data: patientWithUser, error: patientUserError } = await supabaseClient
      .from('patient_accounts')
      .select('user_id, first_name, last_name, email, phone, practice_id')
      .eq('id', data.patient_id)
      .single();

    if (patientUserError) {
      console.error('[book-appointment] Error fetching patient user data:', patientUserError);
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
        console.error('[book-appointment] Error fetching practice address:', practiceError);
      }
      
      const isVideo = visitType === 'video';
      
      if (patientWithUser.user_id) {
        // Patient has portal access - use handleNotifications
        console.log('[book-appointment] Patient has portal access, calling handleNotifications');
        try {
          let message;
          if (isVideo) {
            message = `Your appointment request for a video appointment on ${appointmentDateFormatted} at ${appointmentTimeFormatted} has been submitted and is pending approval.`;
          } else {
            const address = practice 
              ? `${practice.address_street}, ${practice.address_city}, ${practice.address_state} ${practice.address_zip}`
              : '';
            message = `Your appointment request for an in-office appointment on ${appointmentDateFormatted} at ${appointmentTimeFormatted}${address ? ` at ${address}` : ''} has been submitted and is pending approval.`;
          }
          
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
          console.log('[book-appointment] Notification sent via handleNotifications');
        } catch (notifError) {
          console.error('[book-appointment] Error calling handleNotifications:', notifError);
        }
      } else {
        // No portal access - send email/SMS directly
        console.log('[book-appointment] Patient has no portal access, sending direct email/SMS');
        
        let directMessage;
        if (isVideo) {
          directMessage = `Your appointment request for a video appointment on ${appointmentDateFormatted} at ${appointmentTimeFormatted} has been submitted and is pending approval.`;
        } else {
          const address = practice 
            ? `${practice.address_street}, ${practice.address_city}, ${practice.address_state} ${practice.address_zip}`
            : '';
          directMessage = `Your appointment request for an in-office appointment on ${appointmentDateFormatted} at ${appointmentTimeFormatted}${address ? ` at ${address}` : ''} has been submitted and is pending approval.`;
        }
        
        if (patientWithUser.email) {
          try {
            await sendNotificationEmail({
              to: patientWithUser.email,
              recipientName: patientName,
              subject: 'Appointment Requested',
              title: 'Appointment Requested',
              message: directMessage,
              actionUrl: undefined,
              senderContext: { fromName: 'Your Healthcare Provider' }
            });
            console.log('[book-appointment] Email sent to:', patientWithUser.email);
          } catch (emailError) {
            console.error('[book-appointment] Error sending email:', emailError);
          }
        }
        
        if (patientWithUser.phone) {
          try {
            const normalizedPhone = normalizePhoneToE164(patientWithUser.phone);
            const smsMessage = isVideo
              ? `Video appointment request for ${appointmentDateFormatted} at ${appointmentTimeFormatted}. Pending approval.`
              : `In-office appointment request for ${appointmentDateFormatted} at ${appointmentTimeFormatted}${practice ? ` at ${practice.address_city}, ${practice.address_state}` : ''}. Pending approval.`;
            
            await sendNotificationSms({
              phoneNumber: normalizedPhone,
              message: smsMessage,
              metadata: { appointmentId: data.id }
            });
            console.log('[book-appointment] SMS sent to:', normalizedPhone);
          } catch (smsError) {
            console.error('[book-appointment] Error sending SMS:', smsError);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, appointment: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[book-appointment] Error:', error);
    console.error('[book-appointment] Error stack:', error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
