import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';

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

    // Create appointment scheduled ~1 minute from now
    const now = new Date();
    const scheduledTime = new Date(now.getTime() + 60_000);
    const endTime = new Date(scheduledTime.getTime() + 30 * 60_000); // +30 mins default

    console.log('[create-instant-video-session] Creating appointment with payload', {
      patient_id: patientId,
      provider_id: providerId,
      practice_id: practiceId,
      start_time: scheduledTime.toISOString(),
      end_time: endTime.toISOString(),
      visit_type: 'video',
      status: 'confirmed',
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

    if (appointmentError) {
      console.error('[create-instant-video-session] Insert error:', appointmentError.message);
    }

    if (appointmentError || !appointment) {
      return new Response(
        JSON.stringify({ error: 'Failed to create appointment', details: appointmentError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Wait for trigger to create video_session with retry logic
    let videoSession = null;
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries && !videoSession) {
      await new Promise((resolve) => setTimeout(resolve, retries === 0 ? 1500 : 500));
      
      console.log(`[create-instant-video-session] Attempt ${retries + 1} to fetch video_session for appointment ${appointment.id}`);
      
      const { data, error: sessionError } = await supabase
        .from('video_sessions')
        .select('*')
        .eq('appointment_id', appointment.id)
        .single();

      if (data) {
        videoSession = data;
        console.log('[create-instant-video-session] Video session found:', videoSession.id);
      } else if (sessionError) {
        console.log('[create-instant-video-session] Session error:', sessionError.message);
      }
      
      retries++;
    }

    if (!videoSession) {
      console.error('[create-instant-video-session] Failed to create video session after retries');
      return new Response(
        JSON.stringify({ error: 'Video session not created after multiple retries' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send instant video notification to patient
    console.log('[create-instant-video-session] Sending notification for instant video session');
    
    const { data: patientWithUser, error: patientUserError } = await supabase
      .from('patient_accounts')
      .select('user_id, first_name, last_name, email, phone')
      .eq('id', patientId)
      .single();

    if (patientUserError) {
      console.error('[create-instant-video-session] Error fetching patient user data:', patientUserError);
    } else if (patientWithUser) {
      const patientName = `${patientWithUser.first_name || ''} ${patientWithUser.last_name || ''}`.trim() || 'Patient';
      const appointmentDateFormatted = new Date(appointment.start_time).toLocaleDateString();
      const appointmentTimeFormatted = new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      if (patientWithUser.user_id) {
        // Patient has portal access - use handleNotifications
        console.log('[create-instant-video-session] Patient has portal access, calling handleNotifications');
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
          console.log('[create-instant-video-session] Notification sent via handleNotifications');
        } catch (notifError) {
          console.error('[create-instant-video-session] Error calling handleNotifications:', notifError);
        }
      } else {
        // No portal access - send email/SMS directly
        console.log('[create-instant-video-session] Patient has no portal access, sending direct email/SMS');
        
        const { sendNotificationEmail } = await import('../_shared/notificationEmailSender.ts');
        const { sendNotificationSms } = await import('../_shared/notificationSmsSender.ts');
        
        if (patientWithUser.email) {
          try {
            await sendNotificationEmail({
              to: patientWithUser.email,
              toName: patientName,
              subject: 'Video Session Ready',
              message: `Your instant video session is ready to join.`,
              actionUrl: undefined,
              senderContext: { fromName: 'Your Healthcare Provider' }
            });
            console.log('[create-instant-video-session] Email sent to:', patientWithUser.email);
          } catch (emailError) {
            console.error('[create-instant-video-session] Error sending email:', emailError);
          }
        }
        
        if (patientWithUser.phone) {
          try {
            const normalizePhoneToE164 = (phone: string): string => {
              const cleaned = phone.replace(/\D/g, '');
              if (cleaned.length === 10) return `+1${cleaned}`;
              if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
              return phone;
            };
            const normalizedPhone = normalizePhoneToE164(patientWithUser.phone);
            await sendNotificationSms({
              phoneNumber: normalizedPhone,
              message: `Your instant video session is ready to join.`,
              metadata: { appointmentId: appointment.id, sessionId: videoSession.id }
            });
            console.log('[create-instant-video-session] SMS sent to:', normalizedPhone);
          } catch (smsError) {
            console.error('[create-instant-video-session] Error sending SMS:', smsError);
          }
        }
      }
    }

    // Return the session. Frontend will start the session (ensures proper user authorization)
    return new Response(
      JSON.stringify({ success: true, sessionId: videoSession.id, appointmentId: appointment.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-instant-video-session:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
