import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Normalize gender values to BareMeds API format
 * BareMeds accepts: "M", "F", or "U" (uppercase single letters)
 * 
 * @param genderValue - Can be "Male"/"Female"/"m"/"f"/"u"/null/undefined
 * @returns "M" | "F" | "U" (U for unknown/intersex/prefer not to say)
 */
function normalizeGender(genderValue: string | null | undefined): "M" | "F" | "U" {
  if (!genderValue) return "U";
  
  const normalized = genderValue.toLowerCase().trim();
  
  if (normalized === "m" || normalized === "male") return "M";
  if (normalized === "f" || normalized === "female") return "F";
  if (normalized === "u") return "U";
  
  console.warn(`⚠️ Unknown gender value: "${genderValue}", using "U"`);
  return "U";
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { order_id, pharmacy_email, pharmacy_name, payment_status } = await req.json();

    console.log("📦 Processing order:", { order_id, pharmacy_email, payment_status });

    // Get configured pharmacy email
    const configuredPharmacyEmail = Deno.env.get("BAREMEDS_EMAIL");
    
    // Skip if not configured pharmacy or not paid
    if (configuredPharmacyEmail && pharmacy_email?.toLowerCase() !== configuredPharmacyEmail.toLowerCase()) {
      console.log("⏭️ Skipping: not configured pharmacy");
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: "Not configured pharmacy" }),
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
        gender_at_birth,
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

    // Get gender from order line, with fallback to "U" for practice orders
    const patientGender = normalizeGender(firstLine.gender_at_birth);

    console.log(`📋 Patient gender: ${firstLine.gender_at_birth} → ${patientGender}`);

    // Build BareMeds payload
    const payload = {
      patient: {
        patientId: firstLine.patient_id || `EXT-${order.id}`,
        firstName,
        lastName,
        dob: "2000-01-01", // BareMeds requires DOB, using placeholder for practice orders
        gender: patientGender,
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

    // Get BareMeds configuration
    let apiUrl = Deno.env.get("BAREMEDS_API_URL") || "https://rxorders.baremeds.com";
    
    // Ensure API URL has protocol
    if (!apiUrl.startsWith("http://") && !apiUrl.startsWith("https://")) {
      apiUrl = `https://${apiUrl}`;
    }
    
    const siteId = Deno.env.get("BAREMEDS_SITE_ID") || "98923";
    const apiToken = Deno.env.get("BAREMEDS_API_TOKEN");

    if (!apiToken) {
      throw new Error("BAREMEDS_API_TOKEN environment variable not set");
    }

    const endpoint = `${apiUrl}/api/v1/rx-orders/${siteId}`;

    console.log("🚀 Sending to BareMeds:", {
      apiUrl,
      siteId,
      endpoint,
      patientName: `${payload.patient.firstName} ${payload.patient.lastName}`,
      patientGender: payload.patient.gender,
      prescriptionCount: payload.prescription.length,
    });

    // Send to BareMeds API
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
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
