import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import axios from "https://esm.sh/axios@1.6.7";
import { corsHeaders } from "../_shared/cors.ts";

const TEST_PHARMACY_EMAIL = "dsporn00@yahoo.com";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { order_id, pharmacy_email, pharmacy_name, payment_status } = await req.json();

    console.log("📦 Processing order:", { order_id, pharmacy_email, payment_status });

    // Skip if not test pharmacy or not paid
    if (pharmacy_email?.toLowerCase() !== TEST_PHARMACY_EMAIL.toLowerCase()) {
      console.log("⏭️ Skipping: not test pharmacy");
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: "Not test pharmacy" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payment_status !== "paid") {
      console.log("⏭️ Skipping: payment not paid");
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: "Payment not paid" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch order with patient, provider, and order lines
    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        id,
        created_at,
        patient:patient_accounts!orders_patient_id_fkey(
          first_name,
          last_name,
          date_of_birth,
          gender,
          phone,
          address_line1,
          city,
          state,
          zip,
          external_id
        ),
        provider:providers!orders_provider_id_fkey(
          full_name,
          npi
        ),
        order_lines(
          medication_name,
          quantity,
          refills
        )
      `)
      .eq("id", order_id)
      .single();

    if (error || !order) {
      console.error("❌ Order not found:", error);
      throw new Error(`Order not found: ${error?.message || "Unknown error"}`);
    }

    console.log("✅ Order fetched successfully");

    // Build BareMeds payload
    const payload = {
      patient: {
        patientId: order.patient.external_id || `EXT-${order.id}`,
        firstName: order.patient.first_name,
        lastName: order.patient.last_name,
        dob: order.patient.date_of_birth,
        gender: order.patient.gender || "U",
        phone: order.patient.phone,
        address: {
          line1: order.patient.address_line1,
          city: order.patient.city,
          state: order.patient.state,
          zip: order.patient.zip,
        },
      },
      prescription: order.order_lines.map((line: any) => ({
        drug: { name: line.medication_name },
        quantity: line.quantity,
        refills: line.refills || 0,
      })),
      requestId: order.id,
      timestamp: order.created_at,
      company: "Vitaluxe Services",
    };

    // Get site ID (default to live)
    const siteId = Deno.env.get("BAREMEDS_SITE_ID") || "98923";
    const apiToken = Deno.env.get("BAREMEDS_API_TOKEN");

    if (!apiToken) {
      throw new Error("BAREMEDS_API_TOKEN environment variable not set");
    }

    console.log("🚀 Sending to BareMeds:", {
      siteId,
      endpoint: `https://rxorders.baremeds.com/api/v1/rx-orders/${siteId}`,
      patientName: `${payload.patient.firstName} ${payload.patient.lastName}`,
      prescriptionCount: payload.prescription.length,
    });

    // Send to BareMeds API
    const response = await axios.post(
      `https://rxorders.baremeds.com/api/v1/rx-orders/${siteId}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ BareMeds Response:", response.data);

    return new Response(
      JSON.stringify({
        success: true,
        sent: true,
        response: response.data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("❌ Error sending to BareMeds:", err.message);
    console.error("Full error:", err.response?.data || err);

    return new Response(
      JSON.stringify({
        success: false,
        sent: false,
        error: err.message,
        details: err.response?.data || null,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
