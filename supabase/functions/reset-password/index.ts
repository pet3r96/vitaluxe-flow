import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { validateResetPasswordRequest } from "../_shared/requestValidators.ts";
import { generateSecurePassword } from "../_shared/validators.ts";
import { RateLimiter, RATE_LIMITS, getClientIP } from "../_shared/rateLimiter.ts";

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

    // Rate limiting
    const limiter = new RateLimiter();
    const clientIP = getClientIP(req);
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      clientIP,
      'reset-password',
      RATE_LIMITS.PASSWORD_RESET
    );

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many reset attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON with error handling
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      console.error('Invalid JSON in request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = validateResetPasswordRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data', 
          details: validation.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email }: ResetPasswordRequest = requestData;

    // Generic logging - never log user existence information
    console.log('Password reset request received');

    // Add constant-time delay to prevent timing attacks
    const baseDelay = 200;
    const jitter = Math.random() * 100;
    
    // Check if profile exists by email
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, active, name, email')
      .eq('email', email)
      .maybeSingle();
    
    if (profileError || !profile) {
      // Profile doesn't exist - return success to prevent enumeration
      await new Promise(r => setTimeout(r, baseDelay + jitter));
      console.log('Password reset request processed');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account exists with this email, a password reset email has been sent." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is active
    if (!profile.active) {
      // Add delay to prevent timing-based enumeration
      await new Promise(r => setTimeout(r, baseDelay + jitter));
      
      console.log('Password reset request processed');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account exists with this email, a password reset email has been sent." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get auth user by ID
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    
    if (userError || !authUser.user) {
      // Auth user not found - return success to prevent enumeration
      await new Promise(r => setTimeout(r, baseDelay + jitter));
      console.log('Password reset request processed');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account exists with this email, a password reset email has been sent." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = authUser.user;

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
      p_details: { reset_method: 'forgot_password' }
    });

    // Add delay to match timing of non-existent user path
    await new Promise(r => setTimeout(r, baseDelay + jitter));

    console.log('Password reset request processed');

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
