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

    // Wait briefly for trigger to create video_session
    await new Promise((resolve) => setTimeout(resolve, 600));

    const { data: videoSession, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('appointment_id', appointment.id)
      .single();

    if (sessionError || !videoSession) {
      return new Response(
        JSON.stringify({ error: 'Video session not created', details: sessionError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
