import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('📧 [send-verification-email] Function START');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[send-verification-email] CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[send-verification-email] Parsing request body...');
    const { userId, email, name } = await req.json();
    console.log('[send-verification-email] Request params:', { userId, email, hasName: !!name });

    if (!userId || !email) {
      console.error("❌ [send-verification-email] Missing required fields:", { userId, email });
      return new Response(
        JSON.stringify({ error: 'Missing userId or email' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-verification-email] Creating admin client...');
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate verification token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const correlationId = crypto.randomUUID();

    console.log("📧 [send-verification-email] Generated verification token for:", email, "expires:", expiresAt.toISOString());

    // Insert token into database
    console.log('[send-verification-email] Inserting token into database...');
    const { error: insertError } = await supabaseAdmin
      .from("email_verification_tokens")
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("❌ [send-verification-email] Failed to insert token:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store token" }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('✅ [send-verification-email] Token stored successfully');

    // Build verification link
    const verificationUrl = `https://app.vitaluxeservices.com/verify-email?token=${token}`;
    
    console.log("📤 [send-verification-email] Calling unified-email-sender for:", email);

    // Call unified email sender
    const emailPayload = {
      type: 'transactional',
      to: email,
      subject: 'Verify Your Vitaluxe Email',
      htmlBody: generateVerificationEmailHTML({
        recipientName: name || 'User',
        verificationLink: verificationUrl,
      }),
      textBody: generateVerificationEmailText({
        recipientName: name || 'User',
        verificationLink: verificationUrl,
      }),
      correlationId,
    };
    
    const emailResult = await supabaseAdmin.functions.invoke('unified-email-sender', {
      body: emailPayload,
    });

    if (emailResult.error) {
      console.error("❌ [send-verification-email] Unified email sender error:", emailResult.error);
      throw new Error(`Email sending failed: ${emailResult.error.message}`);
    }

    const postmarkData = emailResult.data;

    console.log(`[send-verification] ✅ Email sent - correlationId: ${correlationId}, messageId: ${postmarkData.messageId}, to: ${email}`);

    // Log success to audit_logs
    await supabaseAdmin.from('audit_logs').insert({
      action_type: 'email_verification',
      user_id: userId,
      user_email: email,
      entity_type: 'email',
      entity_id: postmarkData.messageId,
      details: {
        correlationId,
        postmark_message_id: postmarkData.messageId,
      }
    });

    return new Response(
      JSON.stringify({ success: true, messageId: postmarkData.messageId }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("❌ [send-verification-email] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Email template generators
function generateVerificationEmailHTML(params: {
  recipientName: string;
  verificationLink: string;
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
          <h2>Verify Your Email Address</h2>
          <p>Please click the button below to verify your email address and activate your account:</p>
          <div style="text-align: center;">
            <a href="${params.verificationLink}" class="button">Verify Email</a>
          </div>
          <p style="margin-top: 30px; color: #C8A64B; font-size: 14px;">
            This link will expire in 24 hours. If you did not create an account, please ignore this email.
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

function generateVerificationEmailText(params: {
  recipientName: string;
  verificationLink: string;
}): string {
  return `
Verify Your Email Address

Dear ${params.recipientName},

Please click the link below to verify your email address and activate your account:

${params.verificationLink}

This link will expire in 24 hours. If you did not create an account, please ignore this email.

© ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.
  `.trim();
}
