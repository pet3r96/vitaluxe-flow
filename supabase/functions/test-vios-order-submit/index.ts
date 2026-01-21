/**
 * Test VIOS Order Submit - Submits test order with isTestOrder=true
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { edgeLogger } from '../_shared/logger.ts';
import { isViosEnabled, throttledViosApiRequest, getViosOrderId, type ViosOrderResponse } from '../_shared/vios/index.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isViosEnabled()) {
    return new Response(
      JSON.stringify({ success: false, error: "VIOS integration disabled", code: "VIOS_DISABLED" }),
      { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { test_data } = await req.json();
    if (!test_data) {
      return new Response(
        JSON.stringify({ success: false, error: "test_data required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = {
      general: { referenceId: `test_${Date.now()}`, isTestOrder: true },
      prescriber: { npi: test_data.prescriber_npi, firstName: test_data.prescriber_first_name, lastName: test_data.prescriber_last_name, phone: "(555) 555-5555" },
      patient: { firstName: test_data.patient_first_name, lastName: test_data.patient_last_name, dateOfBirth: test_data.patient_dob, gender: 'u', address1: test_data.patient_address, city: test_data.patient_city, state: test_data.patient_state, zip: test_data.patient_zip, phoneHome: test_data.patient_phone, allergiesRaw: ["NKA"] },
      shipping: { service: test_data.shipping_service || 7623, addressLine1: test_data.patient_address, city: test_data.patient_city, state: test_data.patient_state, zipCode: test_data.patient_zip, recipientType: 'patient', recipientFirstName: test_data.patient_first_name, recipientLastName: test_data.patient_last_name, recipientPhone: test_data.patient_phone },
      rxs: [{ rxType: 'new', quantity: String(test_data.quantity), directions: test_data.directions, foreignRxNumber: `test_rx_${Date.now()}`, ...(test_data.vios_product_id ? { lfProductId: test_data.vios_product_id } : { drugName: test_data.product_name }) }]
    };

    const response = await throttledViosApiRequest<ViosOrderResponse>('/api/orders', { method: 'POST', body: payload });
    const orderId = getViosOrderId(response);

    return new Response(
      JSON.stringify({ success: !!orderId, is_test_order: true, vios_order_id: orderId, payload_sent: payload, vios_response: response }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    edgeLogger.error("VIOS test order error", error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
