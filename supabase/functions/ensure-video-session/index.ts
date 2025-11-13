import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();
    
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

    const { appointmentId } = await req.json();

    if (!appointmentId) {
      return new Response(JSON.stringify({ error: 'Appointment ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[ensure-video-session] Processing appointment:', appointmentId);

    // Check if video session already exists
    const { data: existingSession } = await supabase
      .from('video_sessions')
      .select('id')
      .eq('appointment_id', appointmentId)
      .maybeSingle();

    if (existingSession) {
      console.log('[ensure-video-session] ✅ Session already exists:', existingSession.id);
      return new Response(JSON.stringify({ sessionId: existingSession.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('patient_appointments')
      .select('id, patient_id, provider_id, practice_id, start_time, status, visit_type')
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error('[ensure-video-session] Appointment not found:', appointmentError?.message);
      return new Response(JSON.stringify({ error: 'Appointment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify it's a video appointment
    if (appointment.visit_type !== 'video') {
      return new Response(JSON.stringify({ error: 'Appointment is not a video consultation' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine effective user (handle impersonation)
    let effectiveUserId = user.id;
    try {
      const { data: imp } = await supabase
        .from('active_impersonation_sessions')
        .select('impersonated_user_id')
        .eq('admin_user_id', user.id)
        .eq('revoked', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (imp?.impersonated_user_id) {
        effectiveUserId = imp.impersonated_user_id;
      }
    } catch (_) {}

    // Authorization: practice owner/admin, assigned provider, or staff
    let authorized = appointment.practice_id === effectiveUserId;
    
    if (!authorized) {
      const { data: myProvider } = await supabase
        .from('providers')
        .select('practice_id, id')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      
      const { data: myStaff } = await supabase
        .from('practice_staff')
        .select('practice_id')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      
      authorized = (myProvider?.practice_id === appointment.practice_id) || 
                   (myStaff?.practice_id === appointment.practice_id) ||
                   (myProvider?.id === appointment.provider_id);
    }

    if (!authorized) {
      console.error('[ensure-video-session] Not authorized:', { effectiveUserId, appointment });
      return new Response(JSON.stringify({ error: 'Not authorized to create session for this appointment' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create video session with Agora-friendly channel name
    const channelName = `vlx_${appointmentId.replace(/-/g, '_')}`;
    
    const { data: newSession, error: createError } = await supabase
      .from('video_sessions')
      .insert({
        appointment_id: appointmentId,
        patient_id: appointment.patient_id,
        provider_id: appointment.provider_id,
        practice_id: appointment.practice_id,
        scheduled_start_time: appointment.start_time,
        status: 'scheduled',
        channel_name: channelName
      })
      .select()
      .single();

    if (createError) {
      console.error('[ensure-video-session] Failed to create session:', createError);
      throw createError;
    }

    console.log('[ensure-video-session] ✅ Created new session:', newSession.id);

    // Log session creation
    await supabase.from('video_session_logs').insert({
      session_id: newSession.id,
      event_type: 'session_created',
      user_id: user.id,
      user_type: 'provider',
      event_data: { auto_created: true, channel_name: channelName }
    });

    return new Response(JSON.stringify({ sessionId: newSession.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[ensure-video-session] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
