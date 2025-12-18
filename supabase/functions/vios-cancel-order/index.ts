import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { 
  getViosCredentials, 
  viosRequest, 
  getPharmacyOrderId, 
  isViosPharmacy,
  logViosTransmission
} from '../_shared/viosApi.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancelOrderRequest {
  order_line_id: string;
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseAdmin = createAdminClient();
    
    const requestData: CancelOrderRequest = await req.json();
    const { order_line_id, reason } = requestData;

    if (!order_line_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'order_line_id is required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info("VIOS Cancel Order: Starting", { order_line_id });

    // Get pharmacy order ID from order line
    const { pharmacyOrderId, pharmacyId, orderId } = await getPharmacyOrderId(supabaseAdmin, order_line_id);

    if (!pharmacyOrderId) {
      edgeLogger.info("VIOS Cancel Order: No pharmacy order ID, nothing to cancel at VIOS", { order_line_id });
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: { 
            skipped: true, 
            message: 'Order was not submitted to pharmacy (no pharmacy_order_id)' 
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      edgeLogger.info("VIOS Cancel Order: Pharmacy is not VIOS, skipping", { pharmacyId });
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: { 
            skipped: true, 
            message: 'Pharmacy is not configured for VIOS API' 
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    edgeLogger.info("VIOS Cancel Order: Sending cancel request", { pharmacyOrderId });

    // Make VIOS cancel request (DELETE /api/orders/{id}/cancel)
    const result = await viosRequest<{ success: boolean; message?: string }>(
      credentials,
      'DELETE',
      `/api/orders/${pharmacyOrderId}/cancel`
    );

    // Log transmission
    await logViosTransmission(supabaseAdmin, {
      orderId: orderId!,
      orderLineId: order_line_id,
      pharmacyId,
      transmissionType: 'cancel',
      apiEndpoint: `${credentials.baseUrl}/api/orders/${pharmacyOrderId}/cancel`,
      requestPayload: { reason: reason || 'Order cancelled' },
      responseStatus: result.statusCode || 0,
      responseBody: result.data || { error: result.error },
      pharmacyOrderId,
      success: result.success,
      errorMessage: result.error
    });

    if (!result.success) {
      // Check if it's a "cannot cancel" error (e.g., already shipped)
      const isCannotCancel = result.statusCode === 400 || result.statusCode === 409;
      
      edgeLogger.error("VIOS Cancel Order: API call failed", { 
        error: result.error,
        isCannotCancel
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error,
          cannotCancel: isCannotCancel
        }),
        { status: result.statusCode || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update local order line status
    await supabaseAdmin
      .from('order_lines')
      .update({ 
        status: 'cancelled',
        pharmacy_order_metadata: {
          ...((await supabaseAdmin
            .from('order_lines')
            .select('pharmacy_order_metadata')
            .eq('id', order_line_id)
            .single()).data?.pharmacy_order_metadata || {}),
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason
        }
      })
      .eq('id', order_line_id);

    const duration = Date.now() - startTime;
    edgeLogger.info("VIOS Cancel Order: Success", { pharmacyOrderId, duration });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          pharmacyOrderId,
          cancelled: true
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    edgeLogger.error("VIOS Cancel Order: Exception", { error: errorMsg });
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
