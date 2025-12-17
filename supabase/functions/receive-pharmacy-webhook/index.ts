import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { validatePharmacyWebhookSignature, validateWebhookPayload } from "../_shared/pharmacyWebhookValidator.ts";
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-pharmacy-signature, x-pharmacy-id",
};

// Map pharmacy status to our standard order status
function mapPharmacyStatus(
  pharmacyStatus: string, 
  statusMapping: Record<string, string> | null
): string | undefined {
  if (!pharmacyStatus) return undefined;
  
  const normalizedStatus = pharmacyStatus.toLowerCase().trim();
  
  // Check custom mapping first
  if (statusMapping && typeof statusMapping === 'object') {
    for (const [key, value] of Object.entries(statusMapping)) {
      if (key.toLowerCase() === normalizedStatus) {
        return value;
      }
    }
  }
  
  // Default mappings
  const defaultMappings: Record<string, string> = {
    'received': 'processing',
    'processing': 'processing',
    'compounding': 'processing',
    'ready': 'processing',
    'shipped': 'shipped',
    'shipping': 'shipped',
    'in_transit': 'shipped',
    'in transit': 'shipped',
    'out_for_delivery': 'shipped',
    'out for delivery': 'shipped',
    'delivered': 'delivered',
    'complete': 'delivered',
    'completed': 'delivered',
    'cancelled': 'cancelled',
    'canceled': 'cancelled',
    'returned': 'cancelled',
    'refunded': 'cancelled',
  };
  
  return defaultMappings[normalizedStatus];
}

// Transform VIOS webhook payload to standard format
function transformViosPayload(viosItem: any): any {
  return {
    pharmacy_order_id: viosItem.orderId,
    status: viosItem.rxStatus,
    tracking_number: viosItem.trackingNumber || null,
    carrier: viosItem.shipCarrier || null,
    status_datetime: viosItem.rxStatusDateTime || null,
    rx_number: viosItem.rxNumber || null,
    fill_id: viosItem.fillId || null,
    foreign_rx_number: viosItem.foreignRxNumber || null,
    reference_id: viosItem.referenceId || null,
    drug_name: viosItem.drugName || null,
    delivery_service: viosItem.deliveryService || null,
    ship_address: viosItem.shipAddressLine1 ? {
      line1: viosItem.shipAddressLine1,
      line2: viosItem.shipAddressLine2,
      line3: viosItem.shipAddressLine3,
      city: viosItem.shipCity,
      state: viosItem.shipState,
      zip: viosItem.shipZip,
      country: viosItem.shipCountry
    } : null,
    // Keep original for raw storage
    _original: viosItem
  };
}

// Check if payload is VIOS format (array with orderId and rxStatus)
function isViosPayload(payload: any): boolean {
  if (!Array.isArray(payload)) return false;
  if (payload.length === 0) return false;
  const firstItem = payload[0];
  return firstItem && 
    typeof firstItem === 'object' && 
    ('orderId' in firstItem || 'rxStatus' in firstItem);
}

// Process a single order update
async function processOrderUpdate(
  supabaseAdmin: any,
  pharmacy: any,
  payload: any,
  isViosFormat: boolean
): Promise<{ success: boolean; orderLineId?: string; error?: string }> {
  // Find order line by pharmacy_order_id
  let orderLineId: string | null = null;
  
  if (payload.pharmacy_order_id) {
    const { data: orderLine } = await supabaseAdmin
      .from("order_lines")
      .select("id")
      .eq("pharmacy_order_id", payload.pharmacy_order_id)
      .eq("assigned_pharmacy_id", pharmacy.id)
      .single();
    
    orderLineId = orderLine?.id || null;
  }
  
  // Fall back to order_line_id if provided
  if (!orderLineId && payload.order_line_id) {
    orderLineId = payload.order_line_id;
  }
  
  // Fall back to vitaluxe_order_number
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

      orderLineId = orderLine?.id || null;
    }
  }

  if (!orderLineId) {
    edgeLogger.warn('Order not found for webhook', { 
      pharmacy_order_id: payload.pharmacy_order_id,
      pharmacyId: pharmacy.id 
    });
    return { success: false, error: "Order not found" };
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
      status_details: payload.status_details || payload.delivery_service || null,
      location: payload.location || null,
      estimated_delivery_date: payload.estimated_delivery || null,
      actual_delivery_date: payload.actual_delivery || null,
      raw_tracking_data: isViosFormat ? payload._original : payload,
    });

  if (insertError) {
    edgeLogger.error('Failed to insert tracking update', insertError);
    return { success: false, orderLineId, error: "Failed to save tracking update" };
  }

  // Map pharmacy status to our standard status
  const mappedStatus = mapPharmacyStatus(payload.status, pharmacy.api_status_mapping);

  // Update order line with tracking info and mapped status
  const updateData: Record<string, any> = {};
  
  if (payload.tracking_number) {
    updateData.tracking_number = payload.tracking_number;
  }
  if (payload.carrier) {
    updateData.shipping_carrier = payload.carrier;
  }
  if (mappedStatus) {
    updateData.status = mappedStatus;
    if (mappedStatus === 'delivered') {
      updateData.delivered_at = payload.status_datetime || new Date().toISOString();
    }
    if (mappedStatus === 'shipped') {
      updateData.shipped_at = payload.status_datetime || new Date().toISOString();
    }
  }
  
  if (Object.keys(updateData).length > 0) {
    await supabaseAdmin
      .from("order_lines")
      .update(updateData)
      .eq("id", orderLineId);
  }

  edgeLogger.info('Successfully processed webhook update', { 
    pharmacyName: pharmacy.name, 
    orderLineId,
    originalStatus: payload.status,
    mappedStatus,
    trackingNumber: payload.tracking_number
  });

  return { success: true, orderLineId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();
    
    // Get URL path to check for dynamic routing
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Check if webhook path is in URL (e.g., /receive-pharmacy-webhook/abc123xyz)
    let webhookPath: string | null = null;
    if (pathSegments.length >= 2) {
      webhookPath = pathSegments[pathSegments.length - 1];
    }

    // Get raw body and headers
    const rawBody = await req.text();
    const signature = req.headers.get("x-pharmacy-signature");
    let pharmacyIdHeader = req.headers.get("x-pharmacy-id");

    // Try to find pharmacy by webhook path first
    let pharmacy: any = null;
    
    if (webhookPath && webhookPath !== 'receive-pharmacy-webhook') {
      const { data: pharmacyByPath, error: pathError } = await supabaseAdmin
        .from("pharmacies")
        .select("id, name, webhook_secret, api_enabled, inbound_webhook_enabled, api_status_mapping")
        .eq("inbound_webhook_path", webhookPath)
        .eq("inbound_webhook_enabled", true)
        .single();
      
      if (pharmacyByPath && !pathError) {
        pharmacy = pharmacyByPath;
        edgeLogger.info('Found pharmacy by webhook path', { path: webhookPath, pharmacyId: pharmacy.id });
      }
    }
    
    // Fall back to x-pharmacy-id header
    if (!pharmacy && pharmacyIdHeader) {
      const { data: pharmacyById, error: idError } = await supabaseAdmin
        .from("pharmacies")
        .select("id, name, webhook_secret, api_enabled, inbound_webhook_enabled, api_status_mapping")
        .eq("id", pharmacyIdHeader)
        .single();
      
      if (pharmacyById && !idError) {
        pharmacy = pharmacyById;
      }
    }

    if (!pharmacy) {
      edgeLogger.error('Pharmacy not found', { webhookPath, pharmacyIdHeader });
      return new Response(
        JSON.stringify({ error: "Invalid pharmacy or webhook path" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    if (!pharmacy.api_enabled) {
      return new Response(
        JSON.stringify({ error: "Pharmacy API not enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Validate signature if webhook secret is configured
    if (pharmacy.webhook_secret) {
      const signatureValidation = await validatePharmacyWebhookSignature(
        signature,
        rawBody,
        pharmacy.webhook_secret
      );

      if (!signatureValidation.valid) {
        edgeLogger.error('Signature validation failed', { reason: signatureValidation.reason });
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
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

    // Check if this is VIOS format (array)
    const isViosFormat = isViosPayload(payload);
    
    if (isViosFormat) {
      edgeLogger.info('Processing VIOS webhook format', { 
        itemCount: payload.length,
        pharmacyId: pharmacy.id 
      });
      
      // Process each item in the VIOS array
      const results: Array<{ success: boolean; orderLineId?: string; error?: string }> = [];
      
      for (const viosItem of payload) {
        const transformedPayload = transformViosPayload(viosItem);
        const result = await processOrderUpdate(supabaseAdmin, pharmacy, transformedPayload, true);
        results.push(result);
      }
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      edgeLogger.info('VIOS webhook processing complete', { 
        successCount, 
        failCount,
        pharmacyName: pharmacy.name 
      });
      
      return new Response(
        JSON.stringify({ 
          success: successCount > 0, 
          message: `Processed ${successCount} of ${results.length} updates`,
          results 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Standard payload validation for non-VIOS format
    const payloadValidation = validateWebhookPayload(payload);
    if (!payloadValidation.valid) {
      return new Response(
        JSON.stringify({ error: "Invalid payload", details: payloadValidation.errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Process single standard payload
    const result = await processOrderUpdate(supabaseAdmin, pharmacy, payload, false);
    
    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Tracking update received" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    edgeLogger.error('Error in receive-pharmacy-webhook', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
