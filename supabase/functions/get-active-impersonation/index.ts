import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Verify user is authenticated using the raw JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('[get-active-impersonation] Authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active session for this admin
    const { data: session, error: sessionError } = await supabase
      .from('active_impersonation_sessions')
      .select('*')
      .eq('admin_user_id', user.id)
      .maybeSingle();

    if (sessionError) {
      console.error('[get-active-impersonation] Error fetching session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch impersonation session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if session is expired
    if (session && new Date(session.expires_at) < new Date()) {
      console.log('[get-active-impersonation] Session expired, cleaning up');
      
      // Clean up expired session
      await supabase
        .from('active_impersonation_sessions')
        .delete()
        .eq('id', session.id);
      
      return new Response(
        JSON.stringify({ session: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last activity if session exists and not expired
    if (session) {
      await supabase
        .from('active_impersonation_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', session.id);
    }

    console.log('[get-active-impersonation] Success:', { hasSession: !!session });

    return new Response(
      JSON.stringify({ session }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-active-impersonation] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
