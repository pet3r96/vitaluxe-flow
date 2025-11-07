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

    // Fetch session with appointment details
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select(`
        *,
        patient_appointments!inner(
          id,
          visit_type,
          practice_id,
          providers!inner(
            first_name,
            last_name
          )
        ),
        profiles!video_sessions_patient_id_fkey(
          first_name,
          last_name,
          phone
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify provider authorization
    if (session.provider_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only the assigned provider can start the session' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify appointment is video type
    if (session.patient_appointments.visit_type !== 'video') {
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
    const patientPhone = session.profiles?.phone;
    if (patientPhone) {
      const providerName = `Dr. ${session.patient_appointments.providers.first_name} ${session.patient_appointments.providers.last_name}`;
      const joinUrl = `${Deno.env.get('SITE_URL') || 'https://vitaluxe.lovable.app'}/patient/video/${sessionId}`;
      
      try {
        await supabase.functions.invoke('send-ghl-sms', {
          body: {
            to: patientPhone,
            message: `Your video appointment with ${providerName} is ready!\n\nJoin now: ${joinUrl}\n\nVitaLuxe Healthcare`
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
