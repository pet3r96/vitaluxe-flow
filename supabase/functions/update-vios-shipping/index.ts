import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { viosApiRequest, VIOS_API_URL } from '../_shared/viosAuth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Update VIOS Order Shipping
 * 
 * Per VIOS OpenAPI: PUT /api/orders/{id}/shipping
 * 
 * Path parameter: id (integer) - VIOS order ID
 * Body: OrderShippingModel
 */

// VIOS Shipping Service Codes
const VIOS_SHIPPING_CODES: Record<string, number> = {
  'priority_overnight': 7617,
  'standard_overnight': 7618,
  'overnight_california': 7620,
  '2_day': 7608,
  'ground': 7623,
  'usps_priority': 7615,
  'overnight': 7618,
  'express': 7617,
  'standard': 7623,
};

interface UpdateViosShippingRequest {
  order_line_id: string;
  shipping: {
    service?: string | number;       // Shipping speed or code
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    recipient_type?: 'clinic' | 'patient';
    recipient_first_name?: string;
    recipient_last_name?: string;
    recipient_phone?: string;
    require_signature?: boolean;
    saturday_delivery?: boolean;
  };
}

interface ViosShippingModel {
  service: number;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  recipientType?: 'clinic' | 'patient';
  recipientFirstName?: string;
  recipientLastName?: string;
  recipientPhone?: string;
  requireSignature?: boolean;
  saturdayDelivery?: boolean;
}

function getViosShippingCode(shippingSpeed: string | number | null | undefined): number {
  if (!shippingSpeed) return VIOS_SHIPPING_CODES.standard;
  if (typeof shippingSpeed === 'number') return shippingSpeed;
  
  const normalizedSpeed = shippingSpeed.toLowerCase().replace(/[-_\s]/g, '_');
  return VIOS_SHIPPING_CODES[normalizedSpeed] || VIOS_SHIPPING_CODES.standard;
}

function formatViosPhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  
  if (last10.length !== 10) return phone;
  
  return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
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

    const { order_line_id, shipping }: UpdateViosShippingRequest = await req.json();

    if (!order_line_id) {
      return new Response(
        JSON.stringify({ error: "order_line_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!shipping) {
      return new Response(
        JSON.stringify({ error: "shipping data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info("Processing VIOS shipping update request", { 
      orderLineId: order_line_id
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

    // Parse VIOS order ID as integer
    const viosOrderIdInt = parseInt(String(viosOrderId), 10);
    if (isNaN(viosOrderIdInt)) {
      throw new Error(`Invalid VIOS order ID: ${viosOrderId}`);
    }

    // Build VIOS shipping model per OrderShippingModel schema
    const viosShipping: ViosShippingModel = {
      service: getViosShippingCode(shipping.service),
      addressLine1: shipping.address_line_1 || '',
      addressLine2: shipping.address_line_2,
      city: shipping.city || '',
      state: shipping.state || '',
      zipCode: shipping.zip_code || '',  // "zipCode" per OpenAPI spec
      recipientType: shipping.recipient_type,
      recipientFirstName: shipping.recipient_first_name,
      recipientLastName: shipping.recipient_last_name,
      recipientPhone: formatViosPhone(shipping.recipient_phone),
      requireSignature: shipping.require_signature,
      saturdayDelivery: shipping.saturday_delivery,
    };

    // Validate required fields
    if (!viosShipping.addressLine1 || !viosShipping.city || !viosShipping.state || !viosShipping.zipCode) {
      return new Response(
        JSON.stringify({ error: "address_line_1, city, state, and zip_code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info("Submitting shipping update to VIOS", { 
      orderLineId: order_line_id,
      viosOrderId: viosOrderIdInt,
      newService: viosShipping.service
    });

    // Submit shipping update to VIOS - PUT /api/orders/{id}/shipping
    await viosApiRequest(`/api/orders/${viosOrderIdInt}/shipping`, {
      method: 'PUT',
      body: viosShipping,
    });

    // Log transmission
    await supabaseAdmin.from("pharmacy_order_transmissions").insert({
      order_id: orderLine.order_id,
      order_line_id: order_line_id,
      pharmacy_id: orderLine.assigned_pharmacy_id,
      transmission_type: "shipping_update",
      api_endpoint: `${VIOS_API_URL}/api/orders/${viosOrderIdInt}/shipping`,
      request_payload: viosShipping,
      response_status: 200,
      response_body: { updated: true },
      pharmacy_order_id: viosOrderId,
      success: true,
      error_message: null,
      retry_count: 0,
    });

    // Update order line with new shipping info
    await supabaseAdmin
      .from("order_lines")
      .update({
        shipping_speed: shipping.service as any,
        pharmacy_order_metadata: {
          ...metadata,
          shipping_updated_at: new Date().toISOString(),
          last_shipping_update: viosShipping,
        },
      })
      .eq("id", order_line_id);

    edgeLogger.info("VIOS shipping updated successfully", { 
      orderLineId: order_line_id,
      viosOrderId: viosOrderIdInt
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Shipping updated with VIOS",
        orderLineId: order_line_id,
        viosOrderId: viosOrderIdInt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    edgeLogger.error("update-vios-shipping error", { error: errorMsg });
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
