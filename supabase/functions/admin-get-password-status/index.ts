import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { requireAdmin } from '../_shared/roleChecker.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return errorResponse('Missing authorization header', 401);
    }

    const supabaseClient = createAuthClient(authHeader);
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      edgeLogger.error('Auth error', userError);
      return errorResponse('Unauthorized', 401);
    }

    // Verify caller is admin
    try {
      await requireAdmin(supabaseClient, user.id, 'Forbidden: admin role required');
    } catch (err) {
      const error = err as Error;
      edgeLogger.error('Admin check failed', error);
      return errorResponse(error.message, 403);
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      return errorResponse('target_user_id is required', 400);
    }

    edgeLogger.info('Admin requesting password status', { targetUserId: target_user_id });

    // Use service role to read user_password_status, profiles, and user_terms_acceptances (bypasses RLS)
    const supabaseService = createAdminClient();
    
    const [statusResult, profileResult, termsResult] = await Promise.all([
      supabaseService
        .from('user_password_status')
        .select('must_change_password')
        .eq('user_id', target_user_id)
        .maybeSingle(),
      supabaseService
        .from('profiles')
        .select('temp_password')
        .eq('id', target_user_id)
        .maybeSingle(),
      supabaseService
        .from('user_terms_acceptances')
        .select('id, terms_id, accepted_at')
        .eq('user_id', target_user_id)
        .order('accepted_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    if (statusResult.error) {
      edgeLogger.error('Error reading user_password_status', statusResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to read password status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profileResult.error) {
      edgeLogger.error('Error reading profiles temp_password', profileResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to read profile status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (termsResult.error) {
      edgeLogger.error('Error reading user_terms_acceptances', termsResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to read terms acceptance status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has temp_password flag set
    const hasTempPassword = profileResult.data?.temp_password || false;
    const mustChange = statusResult.data?.must_change_password || false;
    
    // Check if terms are accepted (presence of any acceptance record means accepted)
    const termsAccepted = termsResult.data !== null;

    // If user has temp_password flag, they must change password regardless of other flags
    const finalMustChange = mustChange || hasTempPassword;

    const result = {
      success: true,
      must_change_password: finalMustChange,
      terms_accepted: termsAccepted,
    };

    edgeLogger.info('Returning password status', { targetUserId: target_user_id });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    edgeLogger.error('Unexpected error', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
