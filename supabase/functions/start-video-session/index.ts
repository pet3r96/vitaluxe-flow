import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch session first
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('[start-video-session] Session not found:', sessionError?.message);
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch provider to check authorization
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('user_id, first_name, last_name')
      .eq('id', session.provider_id)
      .single();

    if (providerError || !provider) {
      console.error('[start-video-session] Provider not found:', providerError?.message);
      return new Response(JSON.stringify({ error: 'Provider not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify provider authorization - check against provider's user_id
    if (provider.user_id !== user.id) {
      console.error('[start-video-session] Authorization failed:', { provider_user_id: provider.user_id, auth_user_id: user.id });
      return new Response(JSON.stringify({ error: 'Only the assigned provider can start the session' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('patient_appointments')
      .select('id, visit_type, practice_id')
      .eq('id', session.appointment_id)
      .single();

    if (appointmentError || !appointment) {
      console.error('[start-video-session] Appointment not found:', appointmentError?.message);
      return new Response(JSON.stringify({ error: 'Appointment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch patient profile
    const { data: patientProfile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone')
      .eq('id', session.patient_id)
      .single();

    if (profileError) {
      console.error('[start-video-session] Patient profile not found:', profileError?.message);
    }

    // Verify appointment is video type
    if (appointment.visit_type !== 'video') {
      return new Response(JSON.stringify({ error: 'Appointment is not a video consultation' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update session status to 'waiting'
    const { data: updatedSession, error: updateError } = await supabase
      .from('video_sessions')
      .update({
        status: 'waiting',
        actual_start_time: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log session start
    await supabase.from('video_session_logs').insert({
      session_id: sessionId,
      event_type: 'session_started',
      user_id: user.id,
      user_type: 'provider',
      event_data: { status: 'waiting' }
    });

    // Send SMS to patient (if phone available)
    const patientPhone = patientProfile?.phone;
    if (patientPhone) {
      const providerName = `Dr. ${provider.first_name} ${provider.last_name}`;
      const portalUrl = `${Deno.env.get('SITE_URL') || 'https://vitaluxe.lovable.app'}/patient/video/${sessionId}`;
      
      // Generate guest link automatically
      let guestLinkUrl = '';
      try {
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const { error: linkError } = await supabase
          .from('video_session_guest_links')
          .insert({
            session_id: sessionId,
            token,
            expires_at: expiresAt.toISOString(),
            created_by: user.id,
          });

        if (!linkError) {
          guestLinkUrl = `${Deno.env.get('SITE_URL') || 'https://vitaluxe.lovable.app'}/video-guest/${token}`;
          
          // Log guest link generation
          await supabase.from('video_session_logs').insert({
            session_id: sessionId,
            event_type: 'guest_link_auto_generated',
            user_id: user.id,
            user_type: 'provider',
            event_data: { token_id: token, expires_at: expiresAt.toISOString() }
          });
        }
      } catch (linkGenError) {
        console.error('Failed to generate guest link:', linkGenError);
        // Continue without guest link if generation fails
      }
      
      try {
        // Build SMS message with both options
        let smsMessage = `Your video appointment with ${providerName} is ready!\n\n`;
        
        if (guestLinkUrl) {
          smsMessage += `Option 1 - Portal Login: ${portalUrl}\n`;
          smsMessage += `Option 2 - Guest Access: ${guestLinkUrl}\n\n`;
          smsMessage += `Guest link expires in 24 hours.\n\n`;
        } else {
          smsMessage += `Join now: ${portalUrl}\n\n`;
        }
        
        smsMessage += `VitaLuxe Healthcare`;

        await supabase.functions.invoke('send-ghl-sms', {
          body: {
            to: patientPhone,
            message: smsMessage
          }
        });
      } catch (smsError) {
        console.error('Failed to send SMS:', smsError);
        // Don't fail the whole request if SMS fails
      }
    }

    return new Response(JSON.stringify({
      success: true,
      session: updatedSession,
      message: 'Video session started. Patient has been notified.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error starting video session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
