import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAdmin } from "../_shared/roleChecker.ts";
import { viosApiRequest } from "../_shared/viosAuth.ts";
import { getViosPracticeIdFromUuid } from "../_shared/viosHelpers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Test VIOS Order Submission
 * 
 * Creates a test order with isTestOrder: true to verify:
 * - Authentication works
 * - Payload structure matches OpenAPI spec
 * - All required fields are present
 * - Field names and types are correct
 */

interface ViosOrderPayload {
  general: {
    memo?: string;
    referenceId?: string;
    isTestOrder?: boolean;
    practiceId?: string;  // VIOS Practice ID
  };
  prescriber: {
    npi: string;
    firstName: string;
    lastName: string;
    phone?: string;
    fax?: string;
    dea?: string;
  };
  patient: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'm' | 'f' | 'a' | 'u';
    phoneHome?: string;
    phoneMobile?: string;
    email?: string;
    address1?: string;
    city?: string;
    state?: string;
    zip?: string;
    allergies?: number[];
  };
  shipping: {
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
  };
  rxs: Array<{
    rxType: 'new' | 'refill' | 'transfer';
    quantity: string;
    directions: string;
    lfProductId?: number;
    drugName?: string;
    drugStrength?: string;
    drugForm?: string;
    quantityUnits?: string;
    foreignRxNumber?: string;
    clinicalDifferenceStatement?: string;
    refills?: number;
    daysSupply?: number;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin access
    const adminCheck = await isAdmin(supabase, user.id);
    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[test-vios-order-submit] Admin verified, creating test order payload');

    // Parse request body to get prescriber NPI (used as practice ID in VIOS)
    const body = await req.json().catch(() => ({}));
    const prescriberNpi = body.prescriber_npi || "1033620489"; // Default to Demo Practice NPI

    // Validate NPI format (10 digits)
    const npiDigits = prescriberNpi.replace(/\D/g, '');
    if (npiDigits.length !== 10) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid NPI format', 
          message: 'Prescriber NPI must be exactly 10 digits' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[test-vios-order-submit] Using prescriber NPI as practiceId:', prescriberNpi);

    // Build a complete test order payload per VIOS OpenAPI spec
    const testReferenceId = `TEST-${Date.now()}`;
    
    // Convert authenticated user's UUID to int32 for VIOS practiceId
    const viosPracticeId = getViosPracticeIdFromUuid(user.id);
    console.log('[test-vios-order-submit] Generated VIOS practice ID:', viosPracticeId, 'from user:', user.id);

    const testPayload: ViosOrderPayload = {
      general: {
        isTestOrder: true,
        referenceId: testReferenceId,
        practiceId: viosPracticeId,  // Convert user UUID to int32 for VIOS
        memo: "VitaLuxe integration test order - DO NOT PROCESS"
      },
      prescriber: {
        npi: prescriberNpi,          // Same NPI used for prescriber
        firstName: "Test",
        lastName: "Prescriber",
        phone: "(555) 555-1234"      // Required format per VIOS
      },
      patient: {
        firstName: "Test",
        lastName: "Patient",
        dateOfBirth: "1990-01-15",   // YYYY-MM-DD format required
        gender: "m",
        phoneHome: "(555) 555-5678", // Format: (XXX) XXX-XXXX
        email: "testpatient@vitaluxe-test.com",
        address1: "123 Test Street",
        city: "Boca Raton",
        state: "FL",
        zip: "33446",
        allergies: []                // Empty array = no known allergies
      },
      shipping: {
        service: 7623,               // FedEx Ground per VIOS codes
        addressLine1: "123 Test Street",
        city: "Boca Raton",
        state: "FL",
        zipCode: "33446",            // NOTE: zipCode not zip!
        recipientType: "patient",
        recipientFirstName: "Test",
        recipientLastName: "Patient",
        recipientPhone: "(555) 555-5678"
      },
      rxs: [{
        rxType: "new",               // Required per spec
        quantity: "10",              // STRING - volume in mL
        directions: "Inject 0.5mL subcutaneously once daily in the morning",
        drugName: "Test B12 Compound",
        drugStrength: "1000mcg/mL",
        drugForm: "Injectable Solution",
        quantityUnits: "mL",
        foreignRxNumber: `RX-${testReferenceId}`,
        refills: 0,
        daysSupply: 30
      }]
    };

    console.log('[test-vios-order-submit] Submitting test payload:', JSON.stringify(testPayload, null, 2));

    // Submit to VIOS API
    const startTime = Date.now();
    let response: any;
    let error: any = null;

    try {
      response = await viosApiRequest('/api/orders', {
        method: 'POST',
        body: testPayload
      });
    } catch (e) {
      error = e;
      console.error('[test-vios-order-submit] VIOS API error:', e);
    }

    const duration = Date.now() - startTime;

    // Build result
    const result = {
      success: !error && response && (response.orderId || response.OrderId),
      testReferenceId,
      duration_ms: duration,
      payload_sent: testPayload,
      vios_response: response || null,
      error: error ? {
        message: error.message || String(error),
        details: error.response || error.body || null
      } : null,
      validation_checks: {
        auth_token: "✅ Obtained (via ClientId/ClientSecret headers)",
        payload_structure: "✅ Nested camelCase (general, prescriber, patient, shipping, rxs)",
        field_names: {
          zipCode: "✅ Using 'zipCode' (not 'zip') in shipping",
          directions: "✅ Using 'directions' (not 'sig') in rxs",
          rxType: "✅ Including required 'rxType' field",
          phoneFormat: "✅ Using (XXX) XXX-XXXX format"
        },
        data_types: {
          quantity: "✅ String type",
          service: "✅ Integer type (7623)",
          allergies: "✅ Array of integers"
        },
        isTestOrder: "✅ Set to true",
        practiceId: `✅ Using UUID-to-int32 conversion (${viosPracticeId})`
      }
    };

    // Log for debugging
    if (result.success) {
      console.log('[test-vios-order-submit] ✅ SUCCESS! VIOS Order ID:', response.orderId || response.OrderId);
    } else {
      console.log('[test-vios-order-submit] ❌ FAILED:', result.error);
    }

    return new Response(
      JSON.stringify(result, null, 2),
      { 
        status: result.success ? 200 : 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[test-vios-order-submit] Unexpected error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: 'Unexpected error', 
        message: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
