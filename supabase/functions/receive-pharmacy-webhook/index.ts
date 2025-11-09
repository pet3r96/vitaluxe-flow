import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePharmacyWebhookSignature, validateWebhookPayload } from "../_shared/pharmacyWebhookValidator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-pharmacy-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get raw body and signature
    const rawBody = await req.text();
    const signature = req.headers.get("x-pharmacy-signature");
    const pharmacyIdHeader = req.headers.get("x-pharmacy-id");

    if (!pharmacyIdHeader) {
      return new Response(
        JSON.stringify({ error: "Missing x-pharmacy-id header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Fetch pharmacy to get webhook secret
    const { data: pharmacy, error: pharmacyError } = await supabaseAdmin
      .from("pharmacies")
      .select("id, name, webhook_secret, api_enabled")
      .eq("id", pharmacyIdHeader)
      .single();

    if (pharmacyError || !pharmacy) {
      console.error("Pharmacy not found:", pharmacyIdHeader);
      return new Response(
        JSON.stringify({ error: "Invalid pharmacy" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    if (!pharmacy.api_enabled) {
      return new Response(
        JSON.stringify({ error: "Pharmacy API not enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Validate signature
    const signatureValidation = await validatePharmacyWebhookSignature(
      signature,
      rawBody,
      pharmacy.webhook_secret
    );

    if (!signatureValidation.valid) {
      console.error("Signature validation failed:", signatureValidation.reason);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Parse payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Validate payload structure
    const payloadValidation = validateWebhookPayload(payload);
    if (!payloadValidation.valid) {
      return new Response(
        JSON.stringify({ error: "Invalid payload", details: payloadValidation.errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Find order line
    let orderLineId = payload.order_line_id;
    if (!orderLineId && payload.vitaluxe_order_number) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("order_number", payload.vitaluxe_order_number)
        .single();

      if (order) {
        const { data: orderLine } = await supabaseAdmin
          .from("order_lines")
          .select("id")
          .eq("order_id", order.id)
          .eq("assigned_pharmacy_id", pharmacy.id)
          .single();

        orderLineId = orderLine?.id;
      }
    }

    if (!orderLineId) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Insert tracking update
    const { error: insertError } = await supabaseAdmin
      .from("pharmacy_tracking_updates")
      .insert({
        order_line_id: orderLineId,
        pharmacy_id: pharmacy.id,
        tracking_number: payload.tracking_number || null,
        carrier: payload.carrier || null,
        status: payload.status,
        status_details: payload.status_details || null,
        location: payload.location || null,
        estimated_delivery_date: payload.estimated_delivery || null,
        actual_delivery_date: payload.actual_delivery || null,
        raw_tracking_data: payload,
      });

    if (insertError) {
      console.error("Failed to insert tracking update:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save tracking update" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Update order line tracking if provided
    if (payload.tracking_number) {
      await supabaseAdmin
        .from("order_lines")
        .update({ 
          tracking_number: payload.tracking_number,
          carrier: payload.carrier || null,
          status: payload.status === "delivered" ? "delivered" : 
                  payload.status === "in_transit" ? "shipped" : undefined,
          delivered_at: payload.status === "delivered" ? new Date().toISOString() : undefined,
        })
        .eq("id", orderLineId);
    }

    console.log(`Successfully processed webhook from pharmacy ${pharmacy.name} for order line ${orderLineId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Tracking update received" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error in receive-pharmacy-webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
