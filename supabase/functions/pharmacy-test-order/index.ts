import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { getViosCredentials, getViosToken, viosRequest, logViosTransmission } from '../_shared/viosApi.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestOrderRequest {
  pharmacy_id: string;
}

// Get a valid shipping service code from the pharmacy's configured rates
async function getValidShippingCode(
  supabaseAdmin: any, 
  pharmacyId: string
): Promise<number> {
  // First try to get ground shipping (most common for test orders)
  const { data: groundRate } = await supabaseAdmin
    .from('pharmacy_shipping_rates')
    .select('vios_service_code')
    .eq('pharmacy_id', pharmacyId)
    .eq('shipping_speed', 'ground')
    .eq('enabled', true)
    .single();
  
  if (groundRate?.vios_service_code) {
    return groundRate.vios_service_code;
  }
  
  // Fall back to any enabled rate
  const { data: anyRate } = await supabaseAdmin
    .from('pharmacy_shipping_rates')
    .select('vios_service_code')
    .eq('pharmacy_id', pharmacyId)
    .eq('enabled', true)
    .limit(1)
    .single();
  
  if (anyRate?.vios_service_code) {
    return anyRate.vios_service_code;
  }
  
  // Last resort fallback - will likely fail but API will provide clear error
  edgeLogger.warn('[TestOrder] No valid shipping rates found, using fallback', { pharmacyId });
  return 1;
}

// Generate synthetic test order payload - minimal to avoid practice lookups
function createTestOrderPayload(shippingServiceCode: number): any {
  const testId = `TEST-${Date.now()}`;
  
  return {
    general: {
      referenceId: testId,
      memo: `VitaLuxe Test Order - ${new Date().toISOString()}`,
      isTestOrder: true
      // IMPORTANT: Do NOT include practiceId - let VIOS use authenticated user's default
    },
    prescriber: {
      // NPI is REQUIRED by VIOS - use a valid NPI registered with the VIOS account
      // This NPI must be associated with the authenticated user's network
      npi: "1033620489", // From successful previous orders
      firstName: "Test",
      lastName: "Prescriber",
      address1: "123 Test Street",
      city: "Los Angeles",
      state: "CA",
      zip: "90210",
      phone: "(555) 555-0100"
    },
    patient: {
      firstName: "Test",
      lastName: "Patient",
      gender: "u",
      dateOfBirth: "1990-01-01",
      address1: "456 Patient Lane",
      city: "Los Angeles", 
      state: "CA",
      zip: "90211",
      phoneHome: "(555) 555-0200",
      phoneMobile: "(555) 555-0200",
      email: "test.patient@test.example.com"
    },
    shipping: {
      addressLine1: "456 Patient Lane",
      city: "Los Angeles",
      state: "CA",
      zipCode: "90211",
      service: shippingServiceCode,
      recipientType: "patient",
      recipientFirstName: "Test",
      recipientLastName: "Patient",
      recipientPhone: "(555) 555-0200"
    },
    rxs: [{
      rxType: "new",
      drugName: "Test Compound 100mg Capsules",
      quantity: "30",
      directions: "Take one capsule daily",
      refills: 0,
      dateWritten: new Date().toISOString().split('T')[0],
      specialInstructions: "TEST ORDER - DO NOT PROCESS"
    }]
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const { pharmacy_id }: TestOrderRequest = await req.json();
    
    edgeLogger.info('[TestOrder] Starting test order for pharmacy', { pharmacyId: pharmacy_id });

    // Get VIOS credentials
    const credentials = await getViosCredentials(supabaseAdmin, pharmacy_id);
    if (!credentials) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to get VIOS credentials. Please verify the pharmacy is configured correctly." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Verify token first
    let jwtToken: string;
    try {
      jwtToken = await getViosToken(credentials);
      edgeLogger.info('[TestOrder] VIOS token obtained successfully');
    } catch (tokenError) {
      const errorMsg = tokenError instanceof Error ? tokenError.message : String(tokenError);
      edgeLogger.error('[TestOrder] Token verification failed', { error: errorMsg });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `VIOS authentication failed: ${errorMsg}` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get valid shipping service code for this pharmacy
    const shippingServiceCode = await getValidShippingCode(supabaseAdmin, pharmacy_id);
    edgeLogger.info('[TestOrder] Using shipping service code', { 
      pharmacyId: pharmacy_id, 
      serviceCode: shippingServiceCode 
    });

    // Create test order payload with valid shipping code (no practice ID to avoid lookups)
    const testPayload = createTestOrderPayload(shippingServiceCode);
    edgeLogger.info('[TestOrder] Sending test order', { 
      referenceId: testPayload.general.referenceId,
      isTestOrder: testPayload.general.isTestOrder
    });

    // Send test order to VIOS
    const result = await viosRequest<any>(
      credentials,
      'POST',
      '/api/orders',
      testPayload
    );

    // Log the transmission
    await logViosTransmission(supabaseAdmin, {
      orderId: testPayload.general.referenceId,
      pharmacyId: pharmacy_id,
      transmissionType: 'test_order',
      apiEndpoint: `${credentials.baseUrl}/api/orders`,
      requestPayload: testPayload,
      responseStatus: result.statusCode || 0,
      responseBody: result.data || { error: result.error },
      pharmacyOrderId: result.data?.orderId,
      success: result.success,
      errorMessage: result.error
    });

    if (result.success) {
      edgeLogger.info('[TestOrder] Test order sent successfully', { 
        viosOrderId: result.data?.orderId,
        referenceId: testPayload.general.referenceId
      });

      return new Response(
        JSON.stringify({
          success: true,
          viosOrderId: result.data?.orderId,
          referenceId: testPayload.general.referenceId,
          message: "Test order sent successfully to VIOS",
          details: result.data
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else {
      edgeLogger.error('[TestOrder] Test order failed', { error: result.error });
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          details: result.data
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

  } catch (error) {
    edgeLogger.error('[TestOrder] Unexpected error', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
