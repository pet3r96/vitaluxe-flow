import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    // Fetch order with order lines and patient/provider info
    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        id,
        created_at,
        doctor_id,
        order_lines(
          id,
          patient_id,
          patient_name,
          patient_email,
          patient_phone,
          patient_address,
          provider_id,
          product_id,
          quantity,
          custom_dosage,
          custom_sig,
          products(name)
        )
      `)
      .eq("id", order_id)
      .single();

    if (error || !order) {
      console.error("❌ Order not found:", error);
      throw new Error(`Order not found: ${error?.message || "Unknown error"}`);
    }

    console.log("✅ Order fetched successfully");

    // Get patient info from first order line (assuming all lines have same patient)
    const firstLine = order.order_lines[0];
    if (!firstLine) {
      throw new Error("No order lines found");
    }

    // Parse patient name (assuming format "FirstName LastName" or just a single name)
    const nameParts = (firstLine.patient_name || "Unknown Patient").split(" ");
    const firstName = nameParts[0] || "Unknown";
    const lastName = nameParts.slice(1).join(" ") || "Patient";

    // Parse patient address (assuming format "street, city, state zip")
    const addressStr = firstLine.patient_address || "";
    const addressParts = addressStr.split(",").map(p => p.trim());
    const line1 = addressParts[0] || "";
    const city = addressParts[1] || "";
    const stateZip = addressParts[2] || "";
    const stateZipParts = stateZip.split(" ");
    const state = stateZipParts[0] || "";
    const zip = stateZipParts[1] || "";

    // Build BareMeds payload
    const payload = {
      patient: {
        patientId: firstLine.patient_id || `EXT-${order.id}`,
        firstName,
        lastName,
        dob: "2000-01-01", // BareMeds requires DOB, using placeholder for practice orders
        gender: "U",
        phone: firstLine.patient_phone || "",
        address: {
          line1,
          city,
          state,
          zip,
        },
      },
      prescription: order.order_lines.map((line: any) => ({
        drug: { name: line.products?.name || "Unknown Medication" },
        quantity: line.quantity,
        refills: 0, // BareMeds requires refills field
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
    const response = await fetch(
      `https://rxorders.baremeds.com/api/v1/rx-orders/${siteId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json", // Critical for Laravel Sanctum
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ BareMeds API Response:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorData.substring(0, 500), // Log first 500 chars
      });
      throw new Error(`BareMeds API error (${response.status}): ${errorData.substring(0, 200)}`);
    }

    const responseData = await response.json();
    console.log("✅ BareMeds Response:", responseData);

    return new Response(
      JSON.stringify({
        success: true,
        sent: true,
        response: responseData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("❌ Error sending to BareMeds:", err.message);

    return new Response(
      JSON.stringify({
        success: false,
        sent: false,
        error: err.message,
        details: null,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
