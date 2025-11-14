import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { token, newPassword }: ResetPasswordRequest = await req.json();

    if (!token || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Token and new password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password strength (minimum requirements)
    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch token from database - check both temp_password_tokens and password_reset_tokens
    let resetToken: any = null;
    let tokenSource: 'temp_password' | 'password_reset' = 'password_reset';
    
    // First check temp_password_tokens (for welcome emails)
    const { data: tempToken, error: tempTokenError } = await supabaseAdmin
      .from('temp_password_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    
    if (tempToken && !tempTokenError) {
      resetToken = tempToken;
      tokenSource = 'temp_password';
    } else {
      // If not found in temp_password_tokens, check password_reset_tokens
      const { data: passwordResetToken, error: passwordResetError } = await supabaseAdmin
        .from('password_reset_tokens')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      
      if (passwordResetToken && !passwordResetError) {
        resetToken = passwordResetToken;
        tokenSource = 'password_reset';
      }
    }

    if (!resetToken) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired reset token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired
    if (new Date(resetToken.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Reset token has expired. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token was already used
    if (resetToken.used_at) {
      return new Response(
        JSON.stringify({ error: "Reset token has already been used" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user password and confirm email (user proved email access via reset link)
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      resetToken.user_id,
      { 
        password: newPassword,
        email_confirm: true  // Auto-confirm email since they clicked the reset link
      }
    );

    if (passwordError) {
      console.error("Error updating password:", passwordError);
      throw passwordError;
    }

    // Mark token as used in the appropriate table (one-time use enforcement)
    if (tokenSource === 'temp_password') {
      // For temp_password_tokens, update both 'used' boolean and 'used_at' timestamp
      await supabaseAdmin
        .from('temp_password_tokens')
        .update({ 
          used: true,
          used_at: new Date().toISOString() 
        })
        .eq('token', token);
    } else {
      // For password_reset_tokens, update both 'used' boolean and 'used_at' timestamp
      await supabaseAdmin
        .from('password_reset_tokens')
        .update({ 
          used: true,
          used_at: new Date().toISOString() 
        })
        .eq('token', token);
    }

    // Update user_password_status - DO NOT set must_change_password
    // (user chose their own password, no forced change needed)
    await supabaseAdmin
      .from('user_password_status')
      .upsert({
        user_id: resetToken.user_id,
        must_change_password: false,
        temporary_password_sent: false,
        first_login_completed: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    // Clear temp_password flag from profiles table
    await supabaseAdmin
      .from('profiles')
      .update({
        temp_password: false
      })
      .eq('id', resetToken.user_id);

    // Get user email for auto-login
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(resetToken.user_id);
    
    if (userError || !userData?.user) {
      console.error("Error fetching user data:", userError);
      // Still return success since password was updated
    }

    // Log audit event
    await supabaseAdmin.rpc('log_audit_event', {
      p_action_type: 'password_reset_completed',
      p_entity_type: 'user',
      p_entity_id: resetToken.user_id,
      p_details: { method: 'email_token' }
    });

    console.log("Password reset completed successfully for user:", resetToken.user_id);

    // Get user email for frontend auto-login
    const userEmail = userData?.user?.email;
    console.log('[reset-password-with-token] Returning success with email:', userEmail);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Password reset successfully.",
        email: userEmail, // Include email for auto-login
        userId: resetToken.user_id
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in reset-password-with-token function:", error);
    return new Response(
      JSON.stringify({
        success: false, 
        error: "Failed to reset password. Please try again." 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
