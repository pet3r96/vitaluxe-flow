import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';

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
      console.error('Auth error:', userError);
      return errorResponse('Unauthorized', 401);
    }

    // Verify caller is admin
    const { data: roles, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roles) {
      console.error('Admin check failed:', roleError);
      return errorResponse('Forbidden: admin role required', 403);
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      return errorResponse('target_user_id is required', 400);
    }

    console.log(`Admin ${user.id} requesting password status for user ${target_user_id}`);

    // Use service role to read both user_password_status and profiles (bypasses RLS)
    const supabaseService = createAdminClient();
    
    const [statusResult, profileResult] = await Promise.all([
      supabaseService
        .from('user_password_status')
        .select('must_change_password, terms_accepted')
        .eq('user_id', target_user_id)
        .maybeSingle(),
      supabaseService
        .from('profiles')
        .select('temp_password')
        .eq('id', target_user_id)
        .maybeSingle()
    ]);

    if (statusResult.error) {
      console.error('Error reading user_password_status:', statusResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to read password status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profileResult.error) {
      console.error('Error reading profiles temp_password:', profileResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to read profile status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has temp_password flag set
    const hasTempPassword = profileResult.data?.temp_password || false;
    const mustChange = statusResult.data?.must_change_password || false;
    const termsAccept = statusResult.data?.terms_accepted || false;

    // If user has temp_password flag, they must change password regardless of other flags
    const finalMustChange = mustChange || hasTempPassword;

    const result = {
      success: true,
      must_change_password: finalMustChange,
      terms_accepted: termsAccept,
    };

    console.log(`Returning status for ${target_user_id}:`, result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
