import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { viosApiRequest, VIOS_API_URL } from '../_shared/viosAuth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Refill VIOS Order
 * 
 * Per VIOS OpenAPI: POST /api/orders/refill
 * 
 * RefillOrderRequest:
 * - refilledReferenceId?: string    (our order reference OR...)
 * - refilledLfOrderId?: number      (VIOS order ID)
 * - refilledForeignRxNumber: string (required - original rx reference)
 * - newReferenceId?: string         (new order reference)
 * - newForeignRxNumber?: string     (new rx reference)
 */

interface RefillViosOrderRequest {
  original_order_line_id: string;     // Our original order line ID
  new_order_line_id?: string;         // Our new order line ID (if different)
}

interface ViosRefillRequest {
  refilledReferenceId?: string;
  refilledLfOrderId?: number;
  refilledForeignRxNumber: string;
  newReferenceId?: string;
  newForeignRxNumber?: string;
}

interface ViosRefillResponse {
  orderId?: number;
  orderLfId?: number;
  rxs?: Array<{ rxLfId?: number; foreignRxNumber?: string }>;
  message?: string;
  errors?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { original_order_line_id, new_order_line_id }: RefillViosOrderRequest = await req.json();

    if (!original_order_line_id) {
      return new Response(
        JSON.stringify({ error: "original_order_line_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info("Processing VIOS refill request", { 
      originalOrderLineId: original_order_line_id,
      newOrderLineId: new_order_line_id
    });

    // Fetch original order line with VIOS metadata
    const { data: originalLine, error: lineError } = await supabaseAdmin
      .from("order_lines")
      .select("*, pharmacy_order_metadata")
      .eq("id", original_order_line_id)
      .single();

    if (lineError || !originalLine) {
      throw new Error(`Original order line not found: ${lineError?.message}`);
    }

    const metadata = originalLine.pharmacy_order_metadata as any;
    const viosOrderId = metadata?.vios_order_id;
    const viosRxNumber = metadata?.vios_rx_number;

    if (!viosOrderId && !viosRxNumber) {
      throw new Error("Original order was not submitted to VIOS");
    }

    // Build VIOS refill request per RefillOrderRequest schema
    const viosRefillRequest: ViosRefillRequest = {
      refilledReferenceId: original_order_line_id,
      refilledForeignRxNumber: original_order_line_id, // Required field
    };

    // Include VIOS order ID if available
    if (viosOrderId) {
      const orderId = parseInt(String(viosOrderId), 10);
      if (!isNaN(orderId)) {
        viosRefillRequest.refilledLfOrderId = orderId;
      }
    }

    // If creating new order line for refill, include new references
    if (new_order_line_id && new_order_line_id !== original_order_line_id) {
      viosRefillRequest.newReferenceId = new_order_line_id;
      viosRefillRequest.newForeignRxNumber = new_order_line_id;
    }

    edgeLogger.info("Submitting refill to VIOS", { 
      originalOrderLineId: original_order_line_id,
      viosOrderId,
      hasNewReference: !!new_order_line_id
    });

    // Submit refill to VIOS
    const viosResponse = await viosApiRequest<ViosRefillResponse>('/api/orders/refill', {
      method: 'POST',
      body: viosRefillRequest,
    });

    const newViosOrderId = viosResponse.orderId?.toString();

    // Log transmission
    await supabaseAdmin.from("pharmacy_order_transmissions").insert({
      order_id: originalLine.order_id,
      order_line_id: new_order_line_id || original_order_line_id,
      pharmacy_id: originalLine.assigned_pharmacy_id,
      transmission_type: "refill",
      api_endpoint: `${VIOS_API_URL}/api/orders/refill`,
      request_payload: viosRefillRequest,
      response_status: 200,
      response_body: viosResponse,
      pharmacy_order_id: newViosOrderId || null,
      success: true,
      error_message: null,
      retry_count: 0,
    });

    // Update order line with new VIOS details if we have a new order line
    if (new_order_line_id) {
      await supabaseAdmin
        .from("order_lines")
        .update({
          pharmacy_order_id: newViosOrderId,
          pharmacy_order_metadata: {
            vios_order_id: newViosOrderId,
            refilled_from_order_id: viosOrderId,
            submitted_at: new Date().toISOString(),
            is_refill: true,
          },
          status: 'processing',
          processing_at: new Date().toISOString(),
        })
        .eq("id", new_order_line_id);
    }

    edgeLogger.info("VIOS refill submitted successfully", { 
      originalOrderLineId: original_order_line_id,
      newOrderLineId: new_order_line_id,
      newViosOrderId
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Refill submitted to VIOS",
        viosOrderId: newViosOrderId,
        originalOrderLineId: original_order_line_id,
        newOrderLineId: new_order_line_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    edgeLogger.error("refill-vios-order error", { error: errorMsg });
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
