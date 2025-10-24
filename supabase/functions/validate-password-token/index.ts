import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateTokenRequest {
  token: string;
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

    const { token }: ValidateTokenRequest = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
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

    // Get user email from auth.users table
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(resetToken.user_id);
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        valid: true,
        email: userData.user.email,
        userId: resetToken.user_id,
        tokenSource: tokenSource
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in validate-password-token function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Failed to validate token. Please try again." 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
