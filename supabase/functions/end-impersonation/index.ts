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
      console.error('[end-impersonation] Authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    console.log('[end-impersonation] Request from admin:', user.id);

    // Get active session
    const { data: session, error: sessionError } = await db
      .from('active_impersonation_sessions')
      .select('*')
      .eq('admin_user_id', user.id)
      .maybeSingle();

    if (sessionError) {
      console.error('[end-impersonation] Error fetching session:', sessionError);
    }

    if (session?.impersonation_log_id) {
      // Update the log with end time
      const { error: logError } = await db
        .from('impersonation_logs')
        .update({ end_time: new Date().toISOString() })
        .eq('id', session.impersonation_log_id);

      if (logError) {
        console.error('[end-impersonation] Failed to update log:', logError);
        // Check for RLS violation
        if (logError.code === '42501') {
          return new Response(
            JSON.stringify({ error: 'Denied by row-level security policy' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Delete the active session
    const { error: deleteError } = await db
      .from('active_impersonation_sessions')
      .delete()
      .eq('admin_user_id', user.id);

    if (deleteError) {
      console.error('[end-impersonation] Failed to delete session:', deleteError);
      // Check for RLS violation
      if (deleteError.code === '42501') {
        return new Response(
          JSON.stringify({ error: 'Denied by row-level security policy' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to end impersonation session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[end-impersonation] Success');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[end-impersonation] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
