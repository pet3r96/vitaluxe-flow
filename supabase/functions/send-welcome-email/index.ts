import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  userId: string;
  email: string;
  name: string;
  role: string;
  practiceId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('[send-welcome-email] Function invoked');
  
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

    const { userId, email, name, role, practiceId }: WelcomeEmailRequest = await req.json();

    console.log('[send-welcome-email] Request params:', { userId, email, role, practiceId });

    if (!userId || !email || !name || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, email, name, role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate secure token (7 day expiry for welcome emails)
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    console.log('[send-welcome-email] Generated token, expires:', expiresAt);

    // Store token in temp_password_tokens
    const { error: tokenError } = await supabaseAdmin
      .from('temp_password_tokens')
      .insert({
        user_id: userId,
        token: token,
        expires_at: expiresAt
      });

    if (tokenError) {
      console.error("[send-welcome-email] Error creating token:", tokenError);
      throw tokenError;
    }

    // Get practice information if practiceId provided
    let practiceInfo = null;
    if (practiceId) {
      const { data: practice } = await supabaseAdmin
        .from('profiles')
        .select('name, company, phone')
        .eq('id', practiceId)
        .single();
      practiceInfo = practice;
      console.log('[send-welcome-email] Practice info:', practice?.name);
    }

    // Check if 2FA is enabled for the system
    const { data: systemSettings } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'two_factor_auth_enabled')
      .maybeSingle();

    const twoFactorEnabled = systemSettings?.value === true;

    // Send email via Postmark
    const POSTMARK_API_KEY = Deno.env.get("POSTMARK_API_KEY");
    if (!POSTMARK_API_KEY) {
      console.error("[send-welcome-email] POSTMARK_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    const resetLink = `https://app.vitaluxeservices.com/change-password?token=${token}`;
    
    // Determine if this is a patient or staff/doctor
    const isPatient = role === 'patient';
    const practiceName = practiceInfo?.name || practiceInfo?.company || 'Vitaluxe';

    console.log('[send-welcome-email] Sending email type:', isPatient ? 'patient' : 'staff/doctor');

    const emailSubject = isPatient 
      ? `Welcome to ${practiceName} Patient Portal`
      : "Welcome to Vitaluxe Services";

    const emailHtml = isPatient ? `
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
            <h1>${practiceName}</h1>
          </div>
          <div class="content">
            <h2>Welcome to Your Patient Portal</h2>
            <p>Hello ${name},</p>
            <p>Your healthcare provider, ${practiceName}, has created a patient portal account for you.</p>
            <p>Click the button below to set your password and access your portal:</p>
            <a href="${resetLink}" class="button">Set Your Password</a>
            <p class="note">This link will expire in 7 days for security reasons.</p>
            ${twoFactorEnabled ? '<p class="note"><strong>Note:</strong> Two-factor authentication is enabled for enhanced security. You will need to set up 2FA after creating your password.</p>' : ''}
            <p>If you have any questions, please contact ${practiceName}${practiceInfo?.phone ? ` at ${practiceInfo.phone}` : ''}.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${practiceName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    ` : `
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
            <h2>Welcome to Vitaluxe Services</h2>
            <p>Hello ${name},</p>
            <p>Your account has been created. Click the button below to set your password and access your dashboard:</p>
            <a href="${resetLink}" class="button">Set Your Password</a>
            <p class="note">This link will expire in 7 days for security reasons.</p>
            ${twoFactorEnabled ? '<p class="note"><strong>Note:</strong> Two-factor authentication is enabled for enhanced security. You will need to set up 2FA after creating your password.</p>' : ''}
            <p>If you have any questions, contact us at support@vitaluxeservices.com</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

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
        Subject: emailSubject,
        HtmlBody: emailHtml,
        TextBody: isPatient 
          ? `Welcome to ${practiceName} Patient Portal\n\nHello ${name},\n\nYour healthcare provider has created a patient portal account for you.\n\nSet your password here: ${resetLink}\n\nThis link will expire in 7 days.\n\n${practiceName}`
          : `Welcome to Vitaluxe Services\n\nHello ${name},\n\nYour account has been created.\n\nSet your password here: ${resetLink}\n\nThis link will expire in 7 days.\n\nVitaluxe Services`
      }),
    });

    if (!postmarkResponse.ok) {
      const errorText = await postmarkResponse.text();
      console.error("[send-welcome-email] Postmark API error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const result = await postmarkResponse.json();
    console.log("[send-welcome-email] Email sent successfully:", result.MessageID);

    // Log audit event
    await supabaseAdmin.rpc('log_audit_event', {
      p_action_type: 'welcome_email_sent',
      p_entity_type: 'user',
      p_entity_id: userId,
      p_details: { 
        email_type: isPatient ? 'patient_welcome' : 'staff_welcome',
        role: role,
        practice_id: practiceId 
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Welcome email sent successfully",
        messageId: result.MessageID 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[send-welcome-email] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to send welcome email" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
