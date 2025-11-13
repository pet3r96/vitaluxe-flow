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

    // Use service role client for all operations (including impersonation checks)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ [generate-video-guest-link] Auth failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [generate-video-guest-link] Authenticated user:', user.id);

    const { sessionId, expirationHours = 1, guestName } = await req.json(); // Default 1 hour

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for active impersonation session
    const { data: impersonationData } = await supabase
      .from('active_impersonation_sessions')
      .select('target_user_id')
      .eq('admin_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const effectiveUserId = impersonationData?.target_user_id || user.id;

    console.log('Generating guest link for session:', sessionId, 'by user:', effectiveUserId);

    // Verify user has access to this session
    const { data: session, error: sessionError } = await supabase
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

    // Check if user is authorized (provider, staff, or practice owner)
    const isPracticeOwner = session.practice_id === effectiveUserId;
    const { data: provider } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('practice_id', session.practice_id)
      .maybeSingle();

    const { data: staff } = await supabase
      .from('practice_staff')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('practice_id', session.practice_id)
      .maybeSingle();

    console.log('Authorization check:', {
      effectiveUserId,
      isPracticeOwner,
      isProvider: !!provider,
      isStaff: !!staff
    });

    if (!isPracticeOwner && !provider && !staff) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to generate link for this session' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate expiry time (clamp between 1-24 hours)
    const expiryHours = Math.min(Math.max(expirationHours, 1), 24);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    // Generate guest token using DB function
    const { data: tokenData, error: tokenGenError } = await supabase
      .rpc('generate_guest_token');

    if (tokenGenError || !tokenData) {
      console.error('[generate-video-guest-link] Failed to generate token:', tokenGenError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate guest token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert guest token
    const { data: guestLink, error: insertError } = await supabase
      .from('video_guest_tokens')
      .insert({
        session_id: sessionId,
        token: tokenData,
        guest_name: guestName || null,
        expires_at: expiresAt.toISOString(),
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

    // Build guest URL
    const origin = req.headers.get('origin') || 
                   req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 
                   'https://vitaluxeservices-app.lovable.app';
    const guestUrl = `${origin}/video-guest/${guestLink.token}`;

    console.log('✅ Guest link generated:', guestUrl);

    return new Response(
      JSON.stringify({
        success: true,
        guestUrl,
        token: guestLink.token,
        expiresAt: expiresAt.toISOString(),
        guestName: guestLink.guest_name
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