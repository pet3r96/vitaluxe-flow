// ============================================================================
// VALIDATE VIDEO GUEST TOKEN
// Validates guest token and returns session details + Agora credentials
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createAgoraTokens } from '../_shared/agoraTokenService.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[validate-video-guest-token] Request received');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[validate-video-guest-token] Token:', token.substring(0, 8) + '...');

    // Lookup guest token
    const { data: guestToken, error: tokenError } = await supabase
      .from('video_guest_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !guestToken) {
      console.error('[validate-video-guest-token] Invalid token');
      return new Response(
        JSON.stringify({ error: 'invalid', message: 'Invalid guest token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(guestToken.expires_at);

    if (now > expiresAt) {
      console.error('[validate-video-guest-token] Token expired');
      return new Response(
        JSON.stringify({ error: 'expired', message: 'Guest link has expired' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('id', guestToken.session_id)
      .single();

    if (sessionError || !session) {
      console.error('[validate-video-guest-token] Session not found');
      return new Response(
        JSON.stringify({ error: 'session_ended', message: 'Video session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if session is still active
    if (session.status === 'ended') {
      console.error('[validate-video-guest-token] Session already ended');
      return new Response(
        JSON.stringify({ error: 'session_ended', message: 'Video session has ended' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[validate-video-guest-token] Valid token for session:', session.id);

    // Mark token as used (first use only)
    if (!guestToken.used_at) {
      await supabase
        .from('video_guest_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', guestToken.id);
    }

    // Generate Agora tokens (PUBLISHER role for audio/video access)
    const uid = Math.floor(Math.random() * 1000000).toString();
    const tokens = await createAgoraTokens(
      session.channel_name,
      uid,
      'publisher', // Guest can speak and show video
      3600
    );

    // Get practice name for display
    const { data: practice } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', session.practice_id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: session.id,
        channelName: session.channel_name,
        appId: Deno.env.get('AGORA_APP_ID'),
        rtcToken: tokens.rtcToken,
        rtmToken: tokens.rtmToken,
        uid,
        rtmUid: uid,
        role: 'guest',
        guest_name: guestToken.guest_name,
        practice_name: practice?.name || 'Practice',
        expires_at: guestToken.expires_at
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[validate-video-guest-token] Error:', error);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
