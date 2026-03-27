import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "0.00";
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

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

    // Send email directly via Postmark with PDF attachment
    const postmarkApiKey = Deno.env.get("POSTMARK_API_KEY");
    const fromEmail = Deno.env.get("POSTMARK_FROM_EMAIL") || "noreply@vitaluxeservices.com";

    if (!postmarkApiKey) {
      console.error("POSTMARK_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: true, emailSent: false, reason: "POSTMARK_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedTotal = formatCurrency(orderTotal);
    const dateStr = new Date().toISOString().split("T")[0];

    const htmlBody = `
      <h2>New Professional Products Order</h2>
      <p><strong>Contact:</strong> ${contactName || "N/A"}</p>
      <p><strong>Email:</strong> ${contactEmail || "N/A"}</p>
      <p><strong>Items:</strong> ${itemCount || 0}</p>
      <p><strong>Total:</strong> $${formattedTotal}</p>
      <p>The completed order form is attached as a PDF.</p>
    `;

    const textBody = `New Professional Products Order\n\nContact: ${contactName || "N/A"}\nEmail: ${contactEmail || "N/A"}\nItems: ${itemCount || 0}\nTotal: $${formattedTotal}\n\nThe completed order form is attached as a PDF.`;

    const postmarkResponse = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": postmarkApiKey,
      },
      body: JSON.stringify({
        From: fromEmail,
        To: opsEmail,
        Subject: `Professional Products Order - ${contactName || "Unknown"} - $${formattedTotal}`,
        HtmlBody: htmlBody,
        TextBody: textBody,
        Attachments: [
          {
            Name: `Pro_Order_${dateStr}.pdf`,
            Content: pdfBase64,
            ContentType: "application/pdf",
          },
        ],
      }),
    });

    if (!postmarkResponse.ok) {
      const errText = await postmarkResponse.text();
      console.error("Postmark send error:", postmarkResponse.status, errText);
      // Don't fail the order — the PDF was already downloaded
    } else {
      console.log("Pro order email sent successfully to", opsEmail);
    }

    return new Response(
      JSON.stringify({ success: true, emailSent: postmarkResponse.ok }),
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
