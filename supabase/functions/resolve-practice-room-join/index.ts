// ============================================================================
// RESOLVE PRACTICE ROOM JOIN
// Determines if user joins existing live session or creates new one
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createAgoraTokens } from '../_shared/agoraTokenService.ts';

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

    // Check for impersonation
    let effectiveUserId = user.id;
    const { data: impersonationSession } = await supabase
      .from('active_impersonation_sessions')
      .select('target_user_id')
      .eq('admin_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (impersonationSession) {
      effectiveUserId = impersonationSession.target_user_id;
      console.log('[resolve-practice-room-join] Impersonation detected:', {
        adminUserId: user.id,
        effectiveUserId
      });
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

    // Verify user is provider/staff/owner in this practice
    const isPracticeOwner = effectiveUserId === practiceRoom.practice_id;
    const { data: provider } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('practice_id', practiceRoom.practice_id)
      .maybeSingle();

    const { data: staff } = await supabase
      .from('practice_staff')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('practice_id', practiceRoom.practice_id)
      .maybeSingle();

    if (!isPracticeOwner && !provider && !staff) {
      console.error('[resolve-practice-room-join] Unauthorized');
      return new Response(
        JSON.stringify({ error: 'Not authorized for this practice' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing live practice room session
    const { data: existingSession } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('practice_id', practiceRoom.practice_id)
      .eq('session_type', 'practice_room')
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let sessionId: string;
    let channelName = practiceRoom.channel_name;

    if (existingSession) {
      console.log('[resolve-practice-room-join] Joining existing session:', existingSession.id);
      sessionId = existingSession.id;
      channelName = existingSession.channel_name;
    } else {
      // Create new session if none active
      console.log('[resolve-practice-room-join] Creating new practice room session');

      const { data: newSession, error: createError } = await supabase
        .from('video_sessions')
        .insert({
          practice_id: practiceRoom.practice_id,
          provider_id: provider?.id || null,
          channel_name: channelName,
          session_type: 'practice_room',
          status: 'live',
          actual_start: new Date().toISOString(),
          created_by_user_id: effectiveUserId
        })
        .select()
        .single();

      if (createError) {
        console.error('[resolve-practice-room-join] Session creation error:', createError);
        throw createError;
      }

      sessionId = newSession.id;
      console.log('[resolve-practice-room-join] New session created:', sessionId);
    }

    // Generate Agora tokens using shared service
    const uid = Math.floor(Math.random() * 1000000).toString();
    const tokens = await createAgoraTokens(
      channelName,
      uid,
      'publisher',
      3600
    );

    console.log('[resolve-practice-room-join] Tokens generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        channelName,
        appId: Deno.env.get('AGORA_APP_ID'),
        rtcToken: tokens.rtcToken,
        rtmToken: tokens.rtmToken,
        uid,
        rtmUid: uid,
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
