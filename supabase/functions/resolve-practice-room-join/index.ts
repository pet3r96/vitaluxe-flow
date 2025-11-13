// ============================================================================
// RESOLVE PRACTICE ROOM JOIN
// Determines if user joins existing live session or creates new one
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { RtcTokenBuilder, RtcRole } from 'https://esm.sh/agora-token@2.0.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResolveRoomRequest {
  roomKey: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[resolve-practice-room-join] Request received');

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
      console.error('[resolve-practice-room-join] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { roomKey }: ResolveRoomRequest = await req.json();

    console.log('[resolve-practice-room-join] Resolving room:', roomKey);

    // Get practice room
    const { data: practiceRoom, error: roomError } = await supabase
      .from('practice_video_rooms')
      .select('*')
      .eq('room_key', roomKey)
      .single();

    if (roomError || !practiceRoom) {
      console.error('[resolve-practice-room-join] Room not found:', roomError);
      return new Response(
        JSON.stringify({ error: 'Practice room not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is provider in this practice
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', user.id)
      .eq('practice_id', practiceRoom.practice_id)
      .single();

    if (providerError || !provider) {
      console.error('[resolve-practice-room-join] Provider verification failed:', providerError);
      return new Response(
        JSON.stringify({ error: 'Not authorized for this practice' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for active session
    let sessionId = practiceRoom.active_session_id;
    let channelName = practiceRoom.channel_name;

    if (sessionId) {
      // Verify session is still live
      const { data: session, error: sessionError } = await supabase
        .from('video_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (!session || session.status === 'ended' || session.status === 'cancelled') {
        console.log('[resolve-practice-room-join] Session ended, creating new one');
        sessionId = null;
      } else {
        console.log('[resolve-practice-room-join] Joining existing session:', sessionId);
        channelName = session.channel_name;
      }
    }

    // Create new session if none active
    if (!sessionId) {
      console.log('[resolve-practice-room-join] Creating new instant session');

      const { data: newSession, error: createError } = await supabase
        .from('video_sessions')
        .insert({
          practice_id: practiceRoom.practice_id,
          provider_id: provider.id,
          channel_name: channelName,
          session_type: 'practice_room',
          status: 'live',
          actual_start: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError || !newSession) {
        console.error('[resolve-practice-room-join] Failed to create session:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create session', details: createError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      sessionId = newSession.id;

      // Update practice room with active session
      await supabase
        .from('practice_video_rooms')
        .update({ active_session_id: sessionId })
        .eq('id', practiceRoom.id);

      console.log('[resolve-practice-room-join] New session created:', sessionId);
    }

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
    const rtmToken = rtcToken;

    console.log('[resolve-practice-room-join] Tokens generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        channelName,
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
    console.error('[resolve-practice-room-join] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
