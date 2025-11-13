// ============================================================================
// CREATE VIDEO SESSION
// Creates instant or scheduled video consultation sessions
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { RtcTokenBuilder, RtcRole } from 'https://esm.sh/agora-token@2.0.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateSessionRequest {
  practiceId: string;
  providerId?: string;
  patientId?: string;
  sessionType: 'instant' | 'scheduled' | 'practice_room';
  scheduledStart?: string; // ISO timestamp
  scheduledEnd?: string;   // ISO timestamp
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[create-video-session] Request received');

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[create-video-session] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CreateSessionRequest = await req.json();
    const { practiceId, providerId, patientId, sessionType, scheduledStart, scheduledEnd } = body;

    console.log('[create-video-session] Creating session:', {
      practiceId,
      providerId,
      patientId,
      sessionType,
      scheduledStart,
    });

    // Verify user is a provider in this practice
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', user.id)
      .eq('practice_id', practiceId)
      .single();

    if (providerError || !provider) {
      console.error('[create-video-session] Provider verification failed:', providerError);
      return new Response(
        JSON.stringify({ error: 'Not authorized for this practice' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique channel name
    const channelName = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Determine initial status
    const status = sessionType === 'scheduled' && scheduledStart ? 'scheduled' : 'live';

    // Create video session
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .insert({
        practice_id: practiceId,
        provider_id: providerId || provider.id,
        patient_id: patientId,
        channel_name: channelName,
        session_type: sessionType,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        status,
        actual_start: status === 'live' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('[create-video-session] Session creation failed:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session', details: sessionError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-video-session] Session created:', session.id);

    // Generate Agora tokens
    const appId = Deno.env.get('VITE_AGORA_APP_ID')!;
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE') || '';
    const uid = Math.floor(Math.random() * 1000000);
    const ttl = 3600; // 1 hour

    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      Math.floor(Date.now() / 1000) + ttl
    );

    const rtmUid = `${uid}`;
    const rtmToken = rtcToken; // Using same token for RTM

    console.log('[create-video-session] Tokens generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          id: session.id,
          channelName,
          status,
          sessionType,
        },
        credentials: {
          rtcToken,
          rtmToken,
          uid: uid.toString(),
          rtmUid,
          appId,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[create-video-session] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
