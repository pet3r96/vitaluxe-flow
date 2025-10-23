import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetEmailRequest {
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

    const { email }: PasswordResetEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting check: max 5 requests per hour per email
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo)
      .eq('user_id', (await supabaseAdmin.from('profiles').select('id').ilike('email', email).single()).data?.id ?? '');

    if (count && count >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many password reset requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user exists
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')
      .ilike('email', email)
      .maybeSingle();

    // Don't reveal if email exists (security best practice)
    // Always return success, but only send email if user exists
    if (profile) {
      // Generate secure token
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      // Store token
      const { error: tokenError } = await supabaseAdmin
        .from('password_reset_tokens')
        .insert({
          user_id: profile.id,
          token: token,
          expires_at: expiresAt
        });

      if (tokenError) {
        console.error("Error creating reset token:", tokenError);
        throw tokenError;
      }

      // Send email via Postmark
      const POSTMARK_API_KEY = Deno.env.get("POSTMARK_API_KEY");
      if (!POSTMARK_API_KEY) {
        console.error("POSTMARK_API_KEY not configured");
        throw new Error("Email service not configured");
      }

      const resetLink = `https://app.vitaluxeservices.com/reset-password?token=${token}`;

      const postmarkResponse = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": POSTMARK_API_KEY,
        },
        body: JSON.stringify({
          From: "noreply@vitaluxeservices.com",
          To: email,
          Subject: "Reset Your Vitaluxe Password",
          HtmlBody: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #E2C977; background-color: #0B0B0B; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; }
                .header { background: linear-gradient(135deg, #8E6E1E 0%, #C8A64B 50%, #E2C977 100%); padding: 30px 20px; text-align: center; }
                .header h1 { margin: 0; color: #0B0B0B; font-size: 28px; font-weight: bold; letter-spacing: 2px; }
                .content { background-color: #1A1A1A; padding: 40px 30px; border: 1px solid #292929; }
                .content h2 { color: #E2C977; margin-top: 0; }
                .content p { color: #E2C977; }
                .button { display: inline-block; background-color: #C8A64B; color: #0B0B0B; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 25px 0; font-weight: bold; transition: background-color 0.3s; }
                .button:hover { background-color: #E2C977; }
                .footer { text-align: center; padding: 25px 20px; color: #8E6E1E; font-size: 12px; background-color: #0B0B0B; }
                .note { color: #C8A64B; font-size: 13px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>VITALUXE</h1>
                </div>
                <div class="content">
                  <h2>Password Reset Request</h2>
                  <p>Hello ${profile.name || 'User'},</p>
                  <p>We received a request to reset your password. Click the button below to create a new password:</p>
                  <a href="${resetLink}" class="button">Reset Password</a>
                  <p class="note">This link will expire in 1 hour for security reasons.</p>
                  <p>If you didn't request a password reset, you can safely ignore this email.</p>
                  <p>If you have any questions, contact us at support@vitaluxeservices.com</p>
                </div>
                <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          TextBody: `Password Reset Request\n\nHello ${profile.name || 'User'},\n\nWe received a request to reset your password.\n\nReset your password here: ${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.\n\nVitaluxe Services`
        }),
      });

      if (!postmarkResponse.ok) {
        const errorText = await postmarkResponse.text();
        console.error("Postmark API error:", errorText);
        throw new Error(`Failed to send email: ${errorText}`);
      }

      const result = await postmarkResponse.json();
      console.log("Password reset email sent successfully:", result.MessageID);

      // Log audit event
      await supabaseAdmin.rpc('log_audit_event', {
        p_action_type: 'password_reset_requested',
        p_entity_type: 'user',
        p_entity_id: profile.id,
        p_details: { method: 'email_token' }
      });
    }

    // Always return success (don't reveal if email exists)
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "If an account exists with this email, a password reset link has been sent." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-password-reset-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Failed to process password reset request" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
