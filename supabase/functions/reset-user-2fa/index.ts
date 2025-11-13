import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify user is admin
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roles) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { targetUserId, reason } = await req.json();

    if (!targetUserId) {
      throw new Error('Target user ID is required');
    }

    // Get target user info
    const { data: targetUser, error: targetUserError } = await supabase.auth.admin.getUserById(targetUserId);
    
    if (targetUserError || !targetUser) {
      throw new Error('Target user not found');
    }

    // Get admin user email
    const { data: adminUser } = await supabase.auth.admin.getUserById(user.id);
    const adminEmail = adminUser?.user?.email || 'unknown';

    // Get current 2FA settings to log previous phone number
    const { data: currentSettings } = await supabase
      .from('user_2fa_settings')
      .select('phone_number')
      .eq('user_id', targetUserId)
      .maybeSingle();

    const previousPhoneNumber = currentSettings?.phone_number || null;

    // Log the reset action
    const { error: logError } = await supabase
      .from('two_fa_reset_logs')
      .insert({
        target_user_id: targetUserId,
        target_user_email: targetUser.user.email || 'unknown',
        reset_by_user_id: user.id,
        reset_by_email: adminEmail,
        reason: reason || 'No reason provided',
        previous_phone_number: previousPhoneNumber
      });

    if (logError) {
      console.error('Error logging reset:', logError);
      // Continue even if logging fails
    }

    // Reset 2FA settings
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('user_2fa_settings')
      .update({
        is_enrolled: false,
        phone_verified: false,
        phone_verified_at: null,
        reset_requested_by: user.id,
        reset_at: now
      })
      .eq('user_id', targetUserId);

    if (updateError) throw updateError;

    console.log(`2FA reset for user ${targetUserId} by admin ${user.id}`);

    return successResponse({ 
      message: 'User 2FA has been reset. They will be prompted to re-enroll on next login.'
    });

  } catch (error: any) {
    console.error('Error in reset-user-2fa:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
});