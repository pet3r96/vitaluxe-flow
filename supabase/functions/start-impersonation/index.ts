import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      console.error('[start-impersonation] Authentication failed:', userError);
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

    // Check impersonation permissions
    const { data: canImpersonate } = await db.rpc('can_user_impersonate', { 
      _user_id: user.id 
    });

    if (!canImpersonate) {
      console.warn('[start-impersonation] User lacks impersonation permission:', user.id);
      return new Response(
        JSON.stringify({ error: 'You are not authorized to use impersonation' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { role, userId, userName, targetEmail }: StartImpersonationRequest = await req.json();

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
