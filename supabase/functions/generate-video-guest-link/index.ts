import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('❌ [generate-video-guest-link] No auth header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: missing auth header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use anon client for auth check with Authorization header
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error('❌ [generate-video-guest-link] Auth failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [generate-video-guest-link] Authenticated user:', user.id);

    // Use service role client for database operations (bypass RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { sessionId, expirationHours = 24 } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for active impersonation session
    const { data: impersonationData } = await supabaseClient
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    const effectiveUserId = impersonationData?.impersonated_user_id || user.id;

    console.log('Generating guest link for session:', sessionId, 'by user:', effectiveUserId);

    // Verify user has access to this session
    const { data: session, error: sessionError } = await supabaseClient
      .from('video_sessions')
      .select('id, practice_id, provider_id, patient_id, status')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is authorized (provider or practice owner)
    const { data: provider } = await supabaseClient
      .from('providers')
      .select('practice_id')
      .eq('user_id', effectiveUserId)
      .single();

    const isPracticeOwner = session.practice_id === effectiveUserId;
    const isProvider = provider && provider.practice_id === session.practice_id;

    console.log('Authorization check:', {
      effectiveUserId,
      isPracticeOwner,
      isProvider,
      sessionPracticeId: session.practice_id,
      providerPracticeId: provider?.practice_id
    });

    if (!isPracticeOwner && !isProvider) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to generate link for this session' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expirationHours);

    // Insert guest link
    const { data: guestLink, error: insertError } = await supabaseClient
      .from('video_session_guest_links')
      .insert({
        session_id: sessionId,
        token,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating guest link:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate guest link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate guest URL
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || 
                   `${req.headers.get('origin') || 'https://app.lovable.app'}`;
    const guestUrl = `${baseUrl}/video-guest/${token}`;

    console.log('✅ Guest link generated successfully:', guestUrl);

    // Log audit event
    await supabaseClient.from('video_session_logs').insert({
      session_id: sessionId,
      event_type: 'guest_link_generated',
      user_type: 'provider',
      event_data: {
        token_id: guestLink.id,
        expires_at: expiresAt.toISOString(),
        created_by: effectiveUserId,
        guest_url: guestUrl,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        guestUrl,
        token,
        expiresAt: expiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-video-guest-link:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});