/**
 * Test VIOS Order Submit - Submits test order with isTestOrder=true
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { edgeLogger } from '../_shared/logger.ts';
import { isViosEnabled, throttledViosApiRequest, getViosOrderId, type ViosOrderResponse } from '../_shared/vios/index.ts';
import { formatViosPhone } from '../_shared/vios/viosValidation.ts';

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
    // Parse body - test_data is optional, use defaults if not provided
    let test_data: Record<string, unknown> = {};
    try {
      const body = await req.json();
      test_data = body.test_data || body || {};
    } catch {
      // Empty body is fine, use defaults
      test_data = {};
    }

    // Use provided NPI or default sandbox NPI (must be authorized in VIOS API Network)
    const prescriberNpi = String(test_data.prescriber_npi || "1234567890");
    // Validate NPI format (exactly 10 digits)
    if (!/^\d{10}$/.test(prescriberNpi)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid NPI format: "${prescriberNpi}". NPI must be exactly 10 digits.`,
          code: "INVALID_NPI"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone - use test default if not provided or invalid
    let patientPhone: string;
    try {
      patientPhone = formatViosPhone(test_data.patient_phone as string) || "(555) 555-5555";
    } catch {
      patientPhone = "(555) 555-5555"; // Safe fallback for test orders
    }

    let prescriberPhone: string;
    try {
      prescriberPhone = formatViosPhone(test_data.prescriber_phone as string) || "(555) 555-5555";
    } catch {
      prescriberPhone = "(555) 555-5555";
    }

    // Build payload WITHOUT practiceId - let VIOS infer from API credentials
    const payload = {
      general: { 
        referenceId: `test_${Date.now()}`, 
        isTestOrder: true
        // NO practiceId - VIOS determines practice from ClientId credentials
      },
      prescriber: { 
        npi: prescriberNpi, 
        firstName: test_data.prescriber_first_name || "Test", 
        lastName: test_data.prescriber_last_name || "Prescriber", 
        phone: prescriberPhone
      },
      patient: { 
        firstName: test_data.patient_first_name || "Test", 
        lastName: test_data.patient_last_name || "Patient", 
        dateOfBirth: test_data.patient_dob || "1990-01-01", 
        gender: 'u', 
        address1: test_data.patient_address || "123 Test St", 
        city: test_data.patient_city || "TestCity", 
        state: test_data.patient_state || "TX", 
        zip: test_data.patient_zip || "75001", 
        phoneHome: patientPhone, 
        allergiesRaw: ["NKA"] 
      },
      shipping: { 
        service: test_data.shipping_service || 7623, 
        addressLine1: test_data.patient_address || "123 Test St", 
        city: test_data.patient_city || "TestCity", 
        state: test_data.patient_state || "TX", 
        zipCode: test_data.patient_zip || "75001", 
        recipientType: 'patient', 
        recipientFirstName: test_data.patient_first_name || "Test", 
        recipientLastName: test_data.patient_last_name || "Patient", 
        recipientPhone: patientPhone
      },
      rxs: [{ 
        rxType: 'new', 
        quantity: String(test_data.quantity || 1), 
        directions: test_data.directions || "Take as directed", 
        foreignRxNumber: `test_rx_${Date.now()}`, 
        ...(test_data.vios_product_id ? { lfProductId: test_data.vios_product_id } : { drugName: test_data.product_name || "Test Compound" }) 
      }]
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
