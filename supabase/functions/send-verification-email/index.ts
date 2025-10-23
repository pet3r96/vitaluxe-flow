import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, name } = await req.json();

    if (!userId || !email) {
      console.error("❌ Missing required fields:", { userId, email });
      return new Response(
        JSON.stringify({ error: 'Missing userId or email' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate verification token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    console.log("📧 Generating verification token for:", email);

    // Insert token into database
    const { error: insertError } = await supabaseAdmin
      .from("email_verification_tokens")
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("❌ Failed to insert token:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store token" }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build verification link
    const verificationUrl = `https://app.vitaluxeservices.com/verify-email?token=${token}`;

    // Send via Postmark template
    const postmarkApiKey = Deno.env.get("POSTMARK_API_KEY");
    const postmarkFromEmail = Deno.env.get("POSTMARK_FROM_EMAIL") || "info@vitaluxeservices.com";

    if (!postmarkApiKey) {
      console.error("❌ POSTMARK_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("📤 Sending verification email via Postmark to:", email);

    const postmarkRes = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": postmarkApiKey,
      },
      body: JSON.stringify({
        From: postmarkFromEmail,
        To: email,
        Subject: "Verify Your Vitaluxe Account",
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
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>VITALUXE</h1>
              </div>
              <div class="content">
                <h2>Welcome to Vitaluxe</h2>
                <p>Hello ${name || "there"},</p>
                <p>Thank you for joining Vitaluxe. Please verify your email address to complete your registration:</p>
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
                <p>This verification link will expire in 24 hours.</p>
                <p>If you didn't create this account, you can safely ignore this email.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        TextBody: `Welcome to Vitaluxe\n\nHello ${name || "there"},\n\nThank you for joining Vitaluxe. Please verify your email address:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nVitaluxe Services`
      }),
    });

    if (!postmarkRes.ok) {
      const errorData = await postmarkRes.text();
      console.error("❌ Postmark API failed:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const postmarkData = await postmarkRes.json();
    console.log("✅ Verification email sent successfully:", postmarkData);

    // Log audit event
    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      user_email: email,
      action_type: "verification_email_sent",
      entity_type: "email_verification_tokens",
      entity_id: token,
      details: {
        email,
        expires_at: expiresAt.toISOString(),
        postmark_message_id: postmarkData.MessageID,
      },
    });

    return new Response(
      JSON.stringify({ success: true, messageId: postmarkData.MessageID }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("❌ Error in send-verification-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
