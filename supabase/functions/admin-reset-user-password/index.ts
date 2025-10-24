import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Invalid authorization token');
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
