import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

interface StartImpersonationRequest {
  role: string;
  userId?: string | null;
  userName?: string | null;
  targetEmail?: string | null;
}

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
      console.error('[start-impersonation] Authentication failed:', userError);
      return errorResponse('Unauthorized', 401);
    }

    // Check if user is super_admin
    const { data: isSuperAdmin } = await db.rpc('is_super_admin', { 
      check_user_id: user.id 
    });

    if (!isSuperAdmin) {
      console.warn('[start-impersonation] User is not super_admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Only super_admin users can impersonate others' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(db, user.id, csrfToken);
    if (!valid) {
      console.error('CSRF validation failed:', csrfError);
      return errorResponse(csrfError || 'Invalid CSRF token', 403);
    }

    const { role, userId, userName, targetEmail }: StartImpersonationRequest = await req.json();

    // Validate role is allowed for impersonation
    const allowedRoles = ['doctor', 'pharmacy', 'topline', 'downline', 'provider', 'patient', 'staff'];
    if (!allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role for impersonation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[start-impersonation] Request:', { 
      adminUserId: user.id, 
      role, 
      targetUserId: userId,
      targetUserName: userName 
    });

    // Create impersonation log entry
    const { data: logData, error: logError } = await db
      .from('impersonation_logs')
      .insert({
        impersonator_id: user.id,
        impersonator_email: user.email || '',
        target_user_id: userId || null,
        target_user_email: targetEmail || '',
        target_user_name: userName || '',
        target_role: role,
        start_time: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (logError || !logData) {
      console.error('[start-impersonation] Failed to create log:', logError);
      // Check for RLS violation
      if (logError?.code === '42501') {
        return new Response(
          JSON.stringify({ error: 'Denied by row-level security policy' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to create impersonation log' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or update active session (UPSERT to handle single session per admin)
    const { data: sessionData, error: sessionError } = await db
      .from('active_impersonation_sessions')
      .upsert({
        admin_user_id: user.id,
        impersonated_role: role,
        impersonated_user_id: userId || null,
        impersonated_user_name: userName || null,
        impersonation_log_id: logData.id,
        last_activity: new Date().toISOString(),
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
      }, {
        onConflict: 'admin_user_id'
      })
      .select()
      .single();

    if (sessionError) {
      console.error('[start-impersonation] Failed to create session:', sessionError);
      // Check for RLS violation
      if (sessionError?.code === '42501') {
        return new Response(
          JSON.stringify({ error: 'Denied by row-level security policy' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to create impersonation session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[start-impersonation] Success:', { sessionId: sessionData.id, logId: logData.id });

    return new Response(
      JSON.stringify({ 
        success: true,
        session: sessionData,
        logId: logData.id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[start-impersonation] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
