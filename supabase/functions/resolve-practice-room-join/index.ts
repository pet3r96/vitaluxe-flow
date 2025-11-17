// ============================================================================
// RESOLVE PRACTICE ROOM JOIN
// Determines if user joins existing live session or creates new one
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createAgoraTokens } from '../_shared/agoraTokenService.ts';
import { edgeLogger } from '../_shared/logger.ts';

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
    edgeLogger.info('Resolve practice room join request received');

    // Get Supabase client (use service role for impersonation checks)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      edgeLogger.error('Auth error in resolve-practice-room-join', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for impersonation
    let effectiveUserId = user.id;
    const { data: impersonationSession } = await supabase
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (impersonationSession) {
      effectiveUserId = impersonationSession.impersonated_user_id;
      edgeLogger.info('Impersonation detected in practice room join', { adminUserId: user.id, effectiveUserId });
    }

    // Parse request
    const { roomKey }: ResolveRoomRequest = await req.json();

    edgeLogger.info('Resolving practice room', { roomKey });

    // Get practice room
    const { data: practiceRoom, error: roomError } = await supabase
      .from('practice_video_rooms')
      .select('*')
      .eq('room_key', roomKey)
      .single();

    if (roomError || !practiceRoom) {
      edgeLogger.error('Practice room not found', roomError);
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
      edgeLogger.error('Unauthorized practice room access', new Error('Not authorized'));
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
      edgeLogger.info('Joining existing practice room session', { sessionId: existingSession.id });
      sessionId = existingSession.id;
      channelName = existingSession.channel_name;
    } else {
      // Create new session if none active
      edgeLogger.info('Creating new practice room session');

      const { data: newSession, error: createError } = await supabase
        .from('video_sessions')
        .insert({
          practice_id: practiceRoom.practice_id,
          provider_id: provider?.id || null,
          channel_name: channelName,
          session_type: 'practice_room',
          status: 'live',
          created_by_user_id: effectiveUserId
        })
        .select()
        .single();

      if (createError) {
        edgeLogger.error('Session creation error', createError);
        throw createError;
      }

      sessionId = newSession.id;
      edgeLogger.info('New practice room session created', { sessionId });
    }

    // Generate Agora tokens using shared service
    const uid = Math.floor(Math.random() * 1000000).toString();
    const tokens = await createAgoraTokens(
      channelName,
      uid,
      'publisher',
      3600
    );

    edgeLogger.info('Practice room tokens generated successfully');

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
    edgeLogger.error('Unexpected error in resolve-practice-room-join', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
