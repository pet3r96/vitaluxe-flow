// ============================================================================
// VALIDATE GUEST TOKEN
// Validates guest access token and returns session info
// ============================================================================

import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { RtcTokenBuilder, RtcRole } from 'https://esm.sh/agora-token@2.0.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateTokenRequest {
  token: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[validate-guest-token] Request received');

    // Get Supabase client (use service role for guest validation)
    const supabase = createAdminClient();

    // Parse request
    const { token }: ValidateTokenRequest = await req.json();

    console.log('[validate-guest-token] Validating token');

    // Get guest token
    const { data: guestToken, error: tokenError } = await supabase
      .from('video_guest_tokens')
      .select('*, video_sessions(id, channel_name, practice_id, status)')
      .eq('token', token)
      .single();

    if (tokenError || !guestToken) {
      console.error('[validate-guest-token] Invalid token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired guest token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(guestToken.expires_at);

    if (now > expiresAt) {
      console.error('[validate-guest-token] Token expired');
      return new Response(
        JSON.stringify({ error: 'Guest token has expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already used (optional - allow re-entry)
    // if (guestToken.used_at) {
    //   return new Response(
    //     JSON.stringify({ error: 'Guest token already used' }),
    //     { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    //   );
    // }

    const session = guestToken.video_sessions;

    if (!session || session.status === 'ended' || session.status === 'cancelled') {
      console.error('[validate-guest-token] Session not available');
      return new Response(
        JSON.stringify({ error: 'Video session is not available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark token as used (first time only)
    if (!guestToken.used_at) {
      await supabase
        .from('video_guest_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', guestToken.id);
    }

    // Generate Agora tokens (guest joins as subscriber/audience)
    const appId = Deno.env.get('VITE_AGORA_APP_ID')!;
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE') || '';
    const uid = Math.floor(Math.random() * 1000000);
    const ttl = 3600; // 1 hour

    // Guest joins as audience (no publishing)
    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      session.channel_name,
      uid,
      RtcRole.SUBSCRIBER,
      Math.floor(Date.now() / 1000) + ttl
    );

    const rtmUid = `guest_${uid}`;
    const rtmToken = rtcToken;

    console.log('[validate-guest-token] Token validated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          id: session.id,
          channelName: session.channel_name,
          practiceId: session.practice_id,
          status: session.status,
        },
        guest: {
          name: guestToken.guest_name,
          email: guestToken.guest_email,
        },
        credentials: {
          rtcToken,
          rtmToken,
          uid: uid.toString(),
          rtmUid,
          appId,
          role: 'guest',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[validate-guest-token] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
