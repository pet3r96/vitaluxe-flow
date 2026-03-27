import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, contactName, contactEmail, practiceId, orderTotal, itemCount } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: "Missing pdfBase64" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get ops email from system settings or use default
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let opsEmail = "operations@vitaluxeservices.com";
    const { data: settings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "pro_order_ops_email")
      .maybeSingle();
    
    if (settings?.value) {
      opsEmail = settings.value;
    }

    // Send email via unified-email-sender
    const { error: emailError } = await supabase.functions.invoke("unified-email-sender", {
      body: {
        to: opsEmail,
        subject: `Professional Products Order - ${contactName || "Unknown"} - $${orderTotal?.toLocaleString() || "0"}`,
        html: `
          <h2>New Professional Products Order</h2>
          <p><strong>Contact:</strong> ${contactName || "N/A"}</p>
          <p><strong>Email:</strong> ${contactEmail || "N/A"}</p>
          <p><strong>Items:</strong> ${itemCount || 0}</p>
          <p><strong>Total:</strong> $${orderTotal?.toLocaleString() || "0"}</p>
          <p>The completed order form is attached as a PDF.</p>
          <p><em>Note: PDF was auto-downloaded by the submitting user. This email serves as notification to operations.</em></p>
        `,
        attachments: [
          {
            filename: `Pro_Order_${new Date().toISOString().split("T")[0]}.pdf`,
            content: pdfBase64,
            encoding: "base64",
            contentType: "application/pdf",
          },
        ],
      },
    });

    if (emailError) {
      console.error("Email send error:", emailError);
      // Don't fail the order — the PDF was already downloaded
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-pro-order error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
