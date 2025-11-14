// ============================================================================
// GENERATE GUEST LINK
// Creates secure guest access token for video sessions
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateGuestLinkRequest {
  sessionId: string;
  guestName?: string;
  guestEmail?: string;
  expiresInHours?: number;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[generate-guest-link] Request received');

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
      console.error('[generate-guest-link] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const {
      sessionId,
      guestName,
      guestEmail,
      expiresInHours = 24,
    }: GenerateGuestLinkRequest = await req.json();

    console.log('[generate-guest-link] Generating token for session:', sessionId);

    // Verify session exists and user has access
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('practice_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('[generate-guest-link] Session not found:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is provider in this practice
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', user.id)
      .eq('practice_id', session.practice_id)
      .single();

    if (providerError || !provider) {
      console.error('[generate-guest-link] Provider verification failed:', providerError);
      return new Response(
        JSON.stringify({ error: 'Not authorized for this session' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate token using database function
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('generate_guest_token');

    if (tokenError || !tokenData) {
      console.error('[generate-guest-link] Failed to generate token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = tokenData;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    // Create guest token record
    const { data: guestToken, error: insertError } = await supabase
      .from('video_guest_tokens')
      .insert({
        session_id: sessionId,
        token,
        guest_name: guestName,
        guest_email: guestEmail,
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[generate-guest-link] Failed to create guest token:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create guest token', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construct guest link
    const baseUrl = Deno.env.get('VITE_SUPABASE_URL')?.replace('/functions/v1', '') || supabaseUrl;
    const guestLink = `${baseUrl}/video/guest/${token}`;

    console.log('[generate-guest-link] Guest token created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        guestLink,
        token,
        expiresAt,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-guest-link] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
