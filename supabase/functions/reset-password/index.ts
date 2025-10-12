import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { generateSecurePassword } from "../_shared/validators.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ResetPasswordRequest = await req.json();

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Password reset requested for: ${email}`);

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

    // Check if user exists
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error("Error fetching users:", userError);
      throw userError;
    }

    const user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      // For security, return generic success message even if user doesn't exist
      console.log(`User not found for email: ${email}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account exists with this email, a password reset email has been sent." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is active
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('active, name')
      .eq('id', user.id)
      .single();

    if (!profile?.active) {
      console.log(`Inactive account: ${email}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account exists with this email, a password reset email has been sent." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate new temporary password
    const temporaryPassword = generateSecurePassword();

    // Update user password
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: temporaryPassword }
    );

    if (passwordError) {
      console.error("Error updating password:", passwordError);
      throw passwordError;
    }

    // Update or insert password status
    const { error: statusError } = await supabaseAdmin
      .from('user_password_status')
      .upsert({
        user_id: user.id,
        must_change_password: true,
        temporary_password_sent: true,
        first_login_completed: false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (statusError) {
      console.error("Error updating password status:", statusError);
      throw statusError;
    }

    // Get user role for email
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    // Send password reset email
    const { error: emailError } = await supabaseAdmin.functions.invoke('send-welcome-email', {
      body: {
        email: email,
        name: profile.name || 'User',
        temporaryPassword: temporaryPassword,
        role: roleData?.role || 'user',
        isPasswordReset: true
      }
    });

    if (emailError) {
      console.error("Error sending reset email:", emailError);
      // Don't throw - password was reset successfully
    }

    // Log audit event
    await supabaseAdmin.rpc('log_audit_event', {
      p_action_type: 'password_reset_requested',
      p_entity_type: 'user',
      p_entity_id: user.id,
      p_details: { email: email, reset_method: 'forgot_password' }
    });

    console.log(`Password reset successful for: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Password reset email sent successfully. Check your inbox for your new temporary password." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in reset-password function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "An error occurred processing your request. Please try again later." 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
