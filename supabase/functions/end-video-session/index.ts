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

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*, patient_appointments!inner(*)')
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
      return new Response(JSON.stringify({ error: 'Only the provider can end the session' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Stop recording if active
    if (session.recording_started_at && !session.recording_stopped_at) {
      try {
        await supabase.functions.invoke('stop-video-recording', {
          body: { sessionId },
          headers: { Authorization: authHeader }
        });
      } catch (error) {
        console.error('Failed to stop recording:', error);
        // Continue ending session even if recording stop fails
      }
    }

    // Calculate duration
    const startTime = new Date(session.actual_start_time || session.scheduled_start_time);
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    // Update session status
    const { data: updatedSession, error: updateError } = await supabase
      .from('video_sessions')
      .update({
        status: 'ended',
        end_time: endTime.toISOString(),
        duration_seconds: durationSeconds,
        provider_left_at: endTime.toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Update appointment status to completed
    await supabase
      .from('patient_appointments')
      .update({ status: 'completed' })
      .eq('id', session.appointment_id);

    // Log session end
    await supabase.from('video_session_logs').insert({
      session_id: sessionId,
      event_type: 'session_ended',
      user_id: user.id,
      user_type: 'provider',
      event_data: { 
        duration_seconds: durationSeconds,
        end_time: endTime.toISOString()
      }
    });

    // Send completion notification to patient (optional)
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          type: 'video_session_complete',
          userId: session.patient_id,
          data: {
            sessionId,
            appointmentId: session.appointment_id
          }
        }
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }

    return new Response(JSON.stringify({
      success: true,
      session: updatedSession,
      durationSeconds,
      message: 'Video session ended successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error ending video session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
