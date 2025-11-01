import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    
    // If no token provided, return no active session (not an error - just means not authenticated)
    if (!token) {
      return new Response(
        JSON.stringify({ session: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      // Return no session instead of 401 - invalid token just means no active impersonation
      return new Response(
        JSON.stringify({ session: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated DB client for RLS-compliant queries
    const db = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: `Bearer ${token}` } }
      }
    );

    // Get active session for this admin
    const { data: session, error: sessionError } = await db
      .from('active_impersonation_sessions')
      .select('*')
      .eq('admin_user_id', user.id)
      .maybeSingle();

    if (sessionError) {
      console.error('[get-active-impersonation] Error fetching session:', sessionError);
      // Check for RLS violation
      if (sessionError.code === '42501') {
        return new Response(
          JSON.stringify({ error: 'Denied by row-level security policy' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to fetch impersonation session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if session is expired
    if (session && new Date(session.expires_at) < new Date()) {
      console.log('[get-active-impersonation] Session expired, cleaning up');
      
      // Clean up expired session
      await db
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
      await db
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
