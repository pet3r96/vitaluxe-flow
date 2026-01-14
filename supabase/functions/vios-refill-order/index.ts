import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { 
  getViosCredentials, 
  viosRequest, 
  getPharmacyOrderId, 
  isViosPharmacy,
  logViosTransmission,
  formatPhoneForVios,
  formatDateForVios
} from '../_shared/viosApi.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RefillOrderRequest {
  order_line_id: string;
  quantity?: number;
  notes?: string;
}

// VIOS Refill payload per Swagger spec: POST /api/orders/refill
// Requires ONE of: refilledReferenceId, refilledLfOrderId, or refilledForeignRxNumber
interface ViosRefillPayload {
  refilledReferenceId?: string;      // Our order_line_id stored as referenceId in VIOS
  refilledLfOrderId?: number;        // VIOS internal order ID (stored as pharmacy_order_id)
  refilledForeignRxNumber?: string;  // Foreign Rx number (optional)
  newReferenceId?: string;           // New reference ID for the refill order
  newForeignRxNumber?: string;       // New foreign Rx number (optional)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseAdmin = createAdminClient();
    
    const requestData: RefillOrderRequest = await req.json();
    const { order_line_id, quantity, notes } = requestData;

    if (!order_line_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'order_line_id is required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info("VIOS Refill Order: Starting", { order_line_id });

    // Get pharmacy order ID from order line
    const { pharmacyOrderId, pharmacyId, orderId } = await getPharmacyOrderId(supabaseAdmin, order_line_id);

    if (!pharmacyOrderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order has not been submitted to pharmacy yet (no pharmacy_order_id)' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pharmacyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order line has no assigned pharmacy' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if pharmacy is VIOS
    const isVios = await isViosPharmacy(supabaseAdmin, pharmacyId);
    if (!isVios) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pharmacy is not configured for VIOS API' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get VIOS credentials
    const credentials = await getViosCredentials(supabaseAdmin, pharmacyId);
    if (!credentials) {
      return new Response(
        JSON.stringify({ success: false, error: 'VIOS credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order line data for refill
    const { data: orderLine, error: lineError } = await supabaseAdmin
      .from('order_lines')
      .select(`
        *,
        patient_accounts!order_lines_patient_id_fkey(
          first_name,
          last_name,
          phone,
          address_street,
          address_city,
          address_state,
          address_zip
        )
      `)
      .eq('id', order_line_id)
      .single();

    if (lineError || !orderLine) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order line not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check refills remaining
    if (orderLine.refills_remaining !== null && orderLine.refills_remaining <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No refills remaining for this prescription' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build VIOS refill payload per Swagger spec
    // VIOS refill uses the original order's referenceId (our order_line_id) or VIOS orderId
    // Refills reuse the original order's shipping/quantity - we just specify which order to refill
    const newRefillId = `REFILL-${order_line_id.substring(0, 8)}-${Date.now()}`;
    
    const refillPayload: ViosRefillPayload = {
      // Use VIOS order ID (pharmacy_order_id) as primary identifier
      refilledLfOrderId: parseInt(pharmacyOrderId, 10),
      // Also provide the original referenceId for cross-reference
      refilledReferenceId: order_line_id,
      // New reference ID for tracking the refill order
      newReferenceId: newRefillId
    };

    edgeLogger.info("VIOS Refill Order: Sending request", { 
      refilledLfOrderId: refillPayload.refilledLfOrderId,
      refilledReferenceId: refillPayload.refilledReferenceId,
      newReferenceId: refillPayload.newReferenceId
    });

    // Make VIOS refill request
    const result = await viosRequest<{ orderId: number; status: string }>(
      credentials,
      'POST',
      '/api/orders/refill',
      refillPayload
    );

    // Log transmission
    await logViosTransmission(supabaseAdmin, {
      orderId: orderId!,
      orderLineId: order_line_id,
      pharmacyId,
      transmissionType: 'refill',
      apiEndpoint: `${credentials.baseUrl}/api/orders/refill`,
      requestPayload: refillPayload,
      responseStatus: result.statusCode || 0,
      responseBody: result.data || { error: result.error },
      pharmacyOrderId: result.data?.orderId?.toString(),
      success: result.success,
      errorMessage: result.error
    });

    if (!result.success) {
      edgeLogger.error("VIOS Refill Order: API call failed", { error: result.error });
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: result.statusCode || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrement refills_remaining on original order line
    if (orderLine.refills_remaining !== null) {
      await supabaseAdmin
        .from('order_lines')
        .update({ refills_remaining: orderLine.refills_remaining - 1 })
        .eq('id', order_line_id);
    }

    const duration = Date.now() - startTime;
    edgeLogger.info("VIOS Refill Order: Success", { 
      newOrderId: result.data?.orderId,
      duration
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          viosOrderId: result.data?.orderId,
          status: result.data?.status,
          refillsRemaining: orderLine.refills_remaining !== null ? orderLine.refills_remaining - 1 : null
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    edgeLogger.error("VIOS Refill Order: Exception", { error: errorMsg });
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
