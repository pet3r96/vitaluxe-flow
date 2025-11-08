import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('❌ [end-video-session] No auth header');
      return new Response(JSON.stringify({ error: 'Unauthorized: missing auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const jwt = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : authHeader;

    // Use anon client for auth check with Authorization header
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(jwt);
    
    if (authError || !user) {
      console.error('❌ [end-video-session] Auth failed:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ [end-video-session] Authenticated user:', user.id);

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sessionId } = await req.json();

    // Check for active impersonation
    const { data: impersonationData } = await supabase
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    const effectiveUserId = impersonationData?.impersonated_user_id || user.id;

    console.log('👤 [end-video-session] User check:', {
      authUserId: user.id,
      effectiveUserId,
      isImpersonating: !!impersonationData,
    });

    // Get video session details
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('id, appointment_id, provider_id, practice_id, status, scheduled_start_time, actual_start_time, recording_started_at, recording_stopped_at, patient_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('❌ [end-video-session] Session not found:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Video session not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify user has permission: provider, practice owner, or staff
    let isAuthorized = false;

    // Check if user is the provider
    const { data: provider } = await supabase
      .from('providers')
      .select('id, practice_id, user_id')
      .eq('id', session.provider_id)
      .maybeSingle();

    const isProvider = provider && provider.user_id === effectiveUserId;
    
    // Check if user is practice owner
    const isPracticeOwner = session.practice_id === effectiveUserId;
    
    // Check if user is staff member
    const { data: staffMember } = await supabase
      .from('practice_staff')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('practice_id', session.practice_id)
      .eq('active', true)
      .maybeSingle();
    
    const isStaff = !!staffMember;

    isAuthorized = isProvider || isPracticeOwner || isStaff;

    console.log('🔐 [end-video-session] Authorization:', {
      isProvider,
      isPracticeOwner,
      isStaff,
      isAuthorized,
      sessionPracticeId: session.practice_id,
      effectiveUserId,
    });

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to end this session. Only the provider, practice owner, or practice staff can end video sessions.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Stop recording if active
    if (session.recording_started_at && !session.recording_stopped_at) {
      try {
        await supabase.functions.invoke('stop-video-recording', {
          body: { sessionId },
          headers: { Authorization: authHeader }
        });
      } catch (error) {
        console.error('⚠️ [end-video-session] Failed to stop recording:', error);
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

    // Log usage for billing
    const durationMinutes = Math.ceil(durationSeconds / 60);
    await supabase.from('usage_logs').insert({
      practice_id: session.practice_id,
      session_id: sessionId,
      provider_id: session.provider_id,
      patient_id: session.patient_id,
      duration_minutes: durationMinutes,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      session_type: 'video'
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
