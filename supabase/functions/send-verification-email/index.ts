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

    const postmarkRes = await fetch("https://api.postmarkapp.com/email/withTemplate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": postmarkApiKey,
      },
      body: JSON.stringify({
        From: postmarkFromEmail,
        To: email,
        TemplateAlias: "verify-account",
        TemplateModel: {
          product_name: "Vitaluxe",
          name: name || "there",
          action_link: verificationUrl,
        },
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
