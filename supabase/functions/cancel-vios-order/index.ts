import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { viosApiRequest, VIOS_API_URL } from '../_shared/viosAuth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cancel VIOS Order
 * 
 * Per VIOS OpenAPI: DELETE /api/orders/{id}/cancel
 * 
 * Path parameter: id (integer) - VIOS order ID
 * Returns empty response on success
 */

interface CancelViosOrderRequest {
  order_line_id: string;     // Our order line ID
  reason?: string;           // Optional cancellation reason
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

    const { order_line_id, reason }: CancelViosOrderRequest = await req.json();

    if (!order_line_id) {
      return new Response(
        JSON.stringify({ error: "order_line_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info("Processing VIOS cancellation request", { 
      orderLineId: order_line_id,
      reason
    });

    // Fetch order line with VIOS metadata
    const { data: orderLine, error: lineError } = await supabaseAdmin
      .from("order_lines")
      .select("*, pharmacy_order_metadata")
      .eq("id", order_line_id)
      .single();

    if (lineError || !orderLine) {
      throw new Error(`Order line not found: ${lineError?.message}`);
    }

    const metadata = orderLine.pharmacy_order_metadata as any;
    const viosOrderId = metadata?.vios_order_id;

    if (!viosOrderId) {
      throw new Error("Order was not submitted to VIOS or VIOS order ID not found");
    }

    // Parse VIOS order ID as integer (per OpenAPI spec)
    const viosOrderIdInt = parseInt(String(viosOrderId), 10);
    if (isNaN(viosOrderIdInt)) {
      throw new Error(`Invalid VIOS order ID: ${viosOrderId}`);
    }

    edgeLogger.info("Submitting cancellation to VIOS", { 
      orderLineId: order_line_id,
      viosOrderId: viosOrderIdInt
    });

    // Submit cancellation to VIOS - DELETE /api/orders/{id}/cancel
    try {
      await viosApiRequest(`/api/orders/${viosOrderIdInt}/cancel`, {
        method: 'DELETE',
      });
    } catch (viosError) {
      // VIOS may return error if order already shipped/cancelled
      const viosErrorMsg = viosError instanceof Error ? viosError.message : String(viosError);
      edgeLogger.warn("VIOS cancellation may have failed", { 
        orderLineId: order_line_id,
        viosOrderId: viosOrderIdInt,
        error: viosErrorMsg
      });
      
      // Log the attempt but don't necessarily fail - order might already be cancelled
      if (!viosErrorMsg.includes('already') && !viosErrorMsg.includes('cancelled')) {
        throw viosError;
      }
    }

    // Log transmission
    await supabaseAdmin.from("pharmacy_order_transmissions").insert({
      order_id: orderLine.order_id,
      order_line_id: order_line_id,
      pharmacy_id: orderLine.assigned_pharmacy_id,
      transmission_type: "cancellation",
      api_endpoint: `${VIOS_API_URL}/api/orders/${viosOrderIdInt}/cancel`,
      request_payload: { reason },
      response_status: 200,
      response_body: { cancelled: true },
      pharmacy_order_id: viosOrderId,
      success: true,
      error_message: null,
      retry_count: 0,
    });

    // Update order line status to cancelled
    await supabaseAdmin
      .from("order_lines")
      .update({
        status: 'cancelled',
        pharmacy_order_metadata: {
          ...metadata,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
        },
      })
      .eq("id", order_line_id);

    edgeLogger.info("VIOS order cancelled successfully", { 
      orderLineId: order_line_id,
      viosOrderId: viosOrderIdInt
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Order cancelled with VIOS",
        orderLineId: order_line_id,
        viosOrderId: viosOrderIdInt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    edgeLogger.error("cancel-vios-order error", { error: errorMsg });
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
