import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
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

    console.log('Creating instant video session:', { patientId, providerId, practiceId });

    // Create appointment immediately scheduled for now
    const now = new Date();
    const scheduledTime = new Date(now.getTime() + 60000); // 1 minute from now to allow setup

    const { data: appointment, error: appointmentError } = await supabase
      .from('patient_appointments')
      .insert({
        patient_id: patientId,
        provider_id: providerId,
        practice_id: practiceId,
        appointment_date: scheduledTime.toISOString().split('T')[0],
        appointment_time: scheduledTime.toTimeString().substring(0, 5),
        visit_type: 'video',
        status: 'confirmed',
        reason_for_visit: 'Instant Video Consultation',
        notes: 'Created instantly by provider',
      })
      .select()
      .single();

    if (appointmentError) {
      console.error('Error creating appointment:', appointmentError);
      return new Response(
        JSON.stringify({ error: 'Failed to create appointment', details: appointmentError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Appointment created:', appointment.id);

    // The trigger will automatically create the video_session
    // Wait a moment and fetch it
    await new Promise(resolve => setTimeout(resolve, 500));

    const { data: videoSession, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('appointment_id', appointment.id)
      .single();

    if (sessionError || !videoSession) {
      console.error('Error fetching video session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Video session not created', details: sessionError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Video session created:', videoSession.id);

    // Immediately start the session
    const { error: startError } = await supabase.functions.invoke('start-video-session', {
      body: { sessionId: videoSession.id }
    });

    if (startError) {
      console.error('Error starting video session:', startError);
      return new Response(
        JSON.stringify({ error: 'Failed to start video session', details: startError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Video session started successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionId: videoSession.id,
        appointmentId: appointment.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-instant-video-session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
