import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    
    if (!token) {
      return errorResponse('Missing or invalid authorization token', 401);
    }

    const db = createAuthClient(authHeader);

    // Verify user is authenticated using the raw JWT token
    const { data: { user }, error: userError } = await db.auth.getUser(token);
    if (userError || !user) {
      console.error('[end-impersonation] Authentication failed:', userError);
      return errorResponse('Unauthorized', 401);
    }

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

    return successResponse({});

  } catch (error) {
    console.error('[end-impersonation] Unexpected error:', error);
    return errorResponse('Internal server error', 500);
  }
});
