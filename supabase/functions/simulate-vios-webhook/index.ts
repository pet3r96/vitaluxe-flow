import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { edgeLogger } from '../_shared/logger.ts';
import { isViosEnabled } from '../_shared/vios/index.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Simulate VIOS Webhook
 * 
 * This edge function simulates incoming VIOS webhook payloads for testing purposes.
 * It sends a test webhook to the receive-pharmacy-webhook endpoint.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isViosEnabled()) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "VIOS integration is currently disabled",
        code: "VIOS_DISABLED"
      }),
      { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const {
      order_line_id,
      referenceId, // Frontend sends this field name
      pharmacy_order_id,
      rx_number,
      rxNumber, // Frontend sends this field name
      rxStatus, // Frontend sends this field name
      status,
      tracking_number,
      trackingNumber, // Frontend sends this field name
      carrier,
      delivery_service = "FEDEX PRIORITY OVERNIGHT"
    } = body;

    // Accept either field name for compatibility
    const orderLineId = order_line_id || referenceId || `test-${Date.now()}`;
    const finalRxNumber = rx_number || rxNumber || `RX-${Date.now()}`;
    const finalStatus = status || rxStatus || "Shipping";
    const finalTrackingNumber = tracking_number || trackingNumber || "390000000000";
    const finalCarrier = carrier || "FEDEX";

    edgeLogger.info("Simulating VIOS webhook", {
      orderLineId,
      pharmacy_order_id,
      status: finalStatus,
      trackingNumber: finalTrackingNumber
    });

    // Build VIOS-format webhook payload (array with single item per VIOS spec)
    const viosPayload = [{
      pharmacyLocation: "VIOS Compounding",
      fillId: `FILL-${Date.now()}`,
      rxNumber: finalRxNumber,
      foreignRxNumber: null,
      orderId: pharmacy_order_id || `ORDER-${Date.now()}`,
      referenceId: orderLineId,
      practiceId: null,
      providerId: null,
      patientId: null,
      lfdrugId: null,
      rxStatus: finalStatus,
      rxStatusDateTime: new Date().toISOString(),
      deliveryService: delivery_service,
      service: delivery_service,
      trackingNumber: finalTrackingNumber,
      shipAddressLine1: "123 Test Street",
      shipAddressLine2: null,
      shipAddressLine3: null,
      shipCity: "TestCity",
      shipState: "TX",
      shipZip: "75001",
      shipCountry: "US",
      shipCarrier: finalCarrier,
      drugName: "Test Medication",
      productid: null,
      drug: {
        name: "Test Medication",
        strength: "10mg",
        form: "Tablet"
      }
    }];

    // Get the webhook URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const webhookUrl = `${supabaseUrl}/functions/v1/receive-pharmacy-webhook/vios-tracking`;

    // Get the VIOS webhook secret for authentication
    const viosWebhookSecret = Deno.env.get("VIOS_WEBHOOK_SECRET");

    // Send the simulated webhook
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(viosWebhookSecret ? { "x-vios-webhook-secret": viosWebhookSecret } : {})
      },
      body: JSON.stringify(viosPayload)
    });

    const webhookResult = await webhookResponse.json().catch(() => ({}));

    edgeLogger.info("Webhook simulation result", {
      status: webhookResponse.status,
      success: webhookResponse.ok,
      result: webhookResult
    });

    return new Response(
      JSON.stringify({
        success: webhookResponse.ok,
        webhook_status: webhookResponse.status,
        webhook_response: webhookResult,
        simulated_payload: viosPayload[0]
      }),
      { 
        status: webhookResponse.ok ? 200 : 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    edgeLogger.error("Webhook simulation error", error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
