import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAuthClient(req.headers.get('Authorization'));
    const supabaseClient = createAdminClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Invalid authorization token');
    }

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabase, user.id, csrfToken);
    if (!valid) {
      console.error('CSRF validation failed:', csrfError);
      return new Response(
        JSON.stringify({ error: csrfError || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roles, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');

    if (roleError || !roles || roles.length === 0) {
      console.error('Role check failed:', roleError);
      throw new Error('Unauthorized: Admin access required');
    }

    const { targetUserId, newPassword } = await req.json();

    if (!targetUserId || !newPassword) {
      throw new Error('targetUserId and newPassword are required');
    }

    console.log(`Admin ${user.email} resetting password for user ${targetUserId}`);

    // Update target user's password using admin API
    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw updateError;
    }

    // Clear must_change_password flag
    const { error: statusError } = await supabaseClient
      .from('user_password_status')
      .update({
        must_change_password: false,
        first_login_completed: true,
        password_last_changed: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', targetUserId);

    if (statusError) {
      console.error('Error updating password status:', statusError);
      // Don't throw - password was set successfully
    }

    // Clear temp_password flag from profiles table
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({
        temp_password: false
      })
      .eq('id', targetUserId);

    if (profileError) {
      console.error('Error clearing temp_password flag:', profileError);
      // Don't throw - password was set successfully
    }

    // Get target user email for logging
    const { data: targetUserData } = await supabaseClient.auth.admin.getUserById(targetUserId);

    // Log audit event
    const { error: auditError } = await supabaseClient
      .from('audit_logs')
      .insert({
        user_id: user.id,
        user_email: user.email,
        user_role: 'admin',
        action_type: 'admin_reset_user_password',
        entity_type: 'profiles',
        entity_id: targetUserId,
        details: {
          reset_by_admin: user.id,
          reset_by_email: user.email,
          target_user_id: targetUserId,
          target_user_email: targetUserData?.user?.email,
          impersonation_context: true,
          timestamp: new Date().toISOString()
        }
      });

    if (auditError) {
      console.error('Error logging audit event:', auditError);
      // Don't throw - password was set successfully
    }

    console.log(`Password reset successful for user ${targetUserId} by admin ${user.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password reset successfully for target user'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-reset-user-password function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
