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

      const resetLink = `https://app.vitaluxeservices.com/change-password?token=${token}`;
      const correlationId = crypto.randomUUID();
      
      console.log(`[send-password-reset] 📧 Calling unified-email-sender - correlationId: ${correlationId}, to: ${email}`);

      // Call unified email sender
      const emailPayload = {
        type: 'transactional',
        to: email,
        subject: 'Reset Your Vitaluxe Password',
        htmlBody: generatePasswordResetEmailHTML({
          recipientName: profile.name || 'User',
          resetLink,
        }),
        textBody: generatePasswordResetEmailText({
          recipientName: profile.name || 'User',
          resetLink,
        }),
        correlationId,
      };
      
      const emailResult = await supabaseAdmin.functions.invoke('unified-email-sender', {
        body: emailPayload,
      });

      if (emailResult.error) {
        console.error("Unified email sender error:", emailResult.error);
        throw new Error(`Email sending failed: ${emailResult.error.message}`);
      }

      const result = emailResult.data;
      console.log(`[send-password-reset] ✅ Email sent - correlationId: ${correlationId}, messageId: ${result.MessageID}`);

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

// Email template generators
function generatePasswordResetEmailHTML(params: {
  recipientName: string;
  resetLink: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #E2C977; background-color: #0B0B0B; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #0B0B0B; }
        .header { background: linear-gradient(135deg, #C8A64B 0%, #E2C977 100%); padding: 40px 20px; text-align: center; border-bottom: none; }
        .header h1 { margin: 0; color: #0B0B0B; font-size: 32px; font-weight: bold; letter-spacing: 4px; }
        .content { background-color: #1A1A1A; padding: 40px 30px; border: none; }
        .content h2 { color: #E2C977; margin-top: 0; }
        .content p { color: #E2C977; }
        .greeting { color: #E2C977; font-size: 16px; margin-bottom: 20px; }
        .button { display: inline-block; background-color: #C8A64B; color: #0B0B0B; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 25px 0; font-weight: bold; }
        .button:hover { background-color: #E2C977; }
        .footer { text-align: center; padding: 25px 20px; color: #8E6E1E; font-size: 12px; background-color: #0B0B0B; }
        .footer a { color: #C8A64B; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>VITALUXE</h1>
        </div>
        <div class="content">
          <p class="greeting">Dear ${params.recipientName},</p>
          <h2>Reset Your Password</h2>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center;">
            <a href="${params.resetLink}" class="button">Reset Password</a>
          </div>
          <p style="margin-top: 30px; color: #C8A64B; font-size: 14px;">
            This link will expire in 1 hour. If you did not request a password reset, please ignore this email.
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.</p>
          <p><a href="https://app.vitaluxeservices.com">Visit Portal</a> | <a href="https://app.vitaluxeservices.com/support">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generatePasswordResetEmailText(params: {
  recipientName: string;
  resetLink: string;
}): string {
  return `
Reset Your Password

Dear ${params.recipientName},

We received a request to reset your password. Click the link below to create a new password:

${params.resetLink}

This link will expire in 1 hour. If you did not request a password reset, please ignore this email.

© ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.
  `.trim();
}
