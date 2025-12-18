import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { 
  getViosCredentials, 
  viosRequest, 
  getPharmacyOrderId, 
  isViosPharmacy,
  logViosTransmission,
  formatPhoneForVios
} from '../_shared/viosApi.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateShippingRequest {
  order_line_id: string;
  shipping: {
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    service_code?: number;
    recipient_first_name?: string;
    recipient_last_name?: string;
    recipient_phone?: string;
    recipient_email?: string;
  };
}

interface ViosShippingPayload {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  service?: number;
  recipientFirstName?: string;
  recipientLastName?: string;
  recipientPhone?: string;
  recipientEmail?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseAdmin = createAdminClient();
    
    const requestData: UpdateShippingRequest = await req.json();
    const { order_line_id, shipping } = requestData;

    if (!order_line_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'order_line_id is required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!shipping || Object.keys(shipping).length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'shipping data is required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info("VIOS Update Shipping: Starting", { order_line_id });

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

    // Build VIOS shipping payload - map our field names to VIOS field names
    const viosPayload: ViosShippingPayload = {};
    
    if (shipping.address_line_1) viosPayload.addressLine1 = shipping.address_line_1;
    if (shipping.address_line_2) viosPayload.addressLine2 = shipping.address_line_2;
    if (shipping.city) viosPayload.city = shipping.city;
    if (shipping.state) viosPayload.state = shipping.state.toUpperCase();
    if (shipping.zip_code) viosPayload.zipCode = shipping.zip_code;
    if (shipping.service_code) viosPayload.service = shipping.service_code;
    if (shipping.recipient_first_name) viosPayload.recipientFirstName = shipping.recipient_first_name;
    if (shipping.recipient_last_name) viosPayload.recipientLastName = shipping.recipient_last_name;
    if (shipping.recipient_phone) viosPayload.recipientPhone = formatPhoneForVios(shipping.recipient_phone) || undefined;
    if (shipping.recipient_email) viosPayload.recipientEmail = shipping.recipient_email;

    edgeLogger.info("VIOS Update Shipping: Sending request", { 
      pharmacyOrderId,
      fieldsToUpdate: Object.keys(viosPayload)
    });

    // Make VIOS update shipping request
    const result = await viosRequest<{ success: boolean; message?: string }>(
      credentials,
      'PUT',
      `/api/orders/${pharmacyOrderId}/shipping`,
      viosPayload
    );

    // Log transmission
    await logViosTransmission(supabaseAdmin, {
      orderId: orderId!,
      orderLineId: order_line_id,
      pharmacyId,
      transmissionType: 'update_shipping',
      apiEndpoint: `${credentials.baseUrl}/api/orders/${pharmacyOrderId}/shipping`,
      requestPayload: viosPayload,
      responseStatus: result.statusCode || 0,
      responseBody: result.data || { error: result.error },
      pharmacyOrderId,
      success: result.success,
      errorMessage: result.error
    });

    if (!result.success) {
      edgeLogger.error("VIOS Update Shipping: API call failed", { error: result.error });
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: result.statusCode || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update local order line with new shipping info if address changed
    const updateData: Record<string, any> = {};
    if (shipping.address_line_1 || shipping.city || shipping.state || shipping.zip_code) {
      const addressParts = [];
      if (shipping.address_line_1) addressParts.push(shipping.address_line_1);
      if (shipping.address_line_2) addressParts.push(shipping.address_line_2);
      if (shipping.city) addressParts.push(shipping.city);
      if (shipping.state && shipping.zip_code) {
        addressParts.push(`${shipping.state} ${shipping.zip_code}`);
      }
      if (addressParts.length > 0) {
        updateData.patient_address = addressParts.join(', ');
      }
      if (shipping.state) {
        updateData.destination_state = shipping.state.toUpperCase();
      }
    }

    if (Object.keys(updateData).length > 0) {
      await supabaseAdmin
        .from('order_lines')
        .update(updateData)
        .eq('id', order_line_id);
    }

    const duration = Date.now() - startTime;
    edgeLogger.info("VIOS Update Shipping: Success", { pharmacyOrderId, duration });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          pharmacyOrderId,
          updatedFields: Object.keys(viosPayload)
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    edgeLogger.error("VIOS Update Shipping: Exception", { error: errorMsg });
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
