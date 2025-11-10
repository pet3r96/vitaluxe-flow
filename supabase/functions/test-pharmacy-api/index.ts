import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { baremedsFetch } from "../_shared/baremedsFetch.ts";
import { createTestOrderPayload } from "../_shared/baremedsPayloads.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestOrderRequest {
  pharmacy_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { pharmacy_id }: TestOrderRequest = await req.json();

    console.log(`[test-pharmacy-api] Sending test order to pharmacy ${pharmacy_id}`);

    // First, run diagnostics to ensure everything is properly configured
    console.log(`[test-pharmacy-api] Running diagnostics first...`);
    try {
      const diagnosticsResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/pharmacy-api-diagnostics`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ pharmacy_id }),
        }
      );

      const diagnosticsData = await diagnosticsResponse.json();
      
      if (!diagnosticsData.success) {
        console.error(`[test-pharmacy-api] Diagnostics failed:`, diagnosticsData);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Pre-flight diagnostics failed. Please resolve issues before sending test orders.",
            diagnostics: diagnosticsData.results,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      console.log(`[test-pharmacy-api] Diagnostics passed, proceeding with test order`);
    } catch (diagError) {
      console.error(`[test-pharmacy-api] Failed to run diagnostics:`, diagError);
      // Continue anyway if diagnostics endpoint fails
    }

    // Fetch pharmacy API configuration
    const { data: pharmacy, error: pharmacyError } = await supabaseAdmin
      .from("pharmacies")
      .select("*")
      .eq("id", pharmacy_id)
      .single();

    if (pharmacyError || !pharmacy) {
      throw new Error(`Pharmacy not found: ${pharmacyError?.message}`);
    }

    if (!pharmacy.api_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: "Pharmacy API not enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!pharmacy.api_endpoint_url) {
      return new Response(
        JSON.stringify({ success: false, error: "No API endpoint configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Fetch API credentials
    const { data: credentials } = await supabaseAdmin
      .from("pharmacy_api_credentials")
      .select("*")
      .eq("pharmacy_id", pharmacy_id);

    // Generate test order payload
    const testTimestamp = new Date().toISOString();
    const testOrderId = `TEST-ORD-${Date.now()}`;
    const testLineId = `TEST-LINE-${Date.now()}`;

    // Helper function to extract site_id from URL path
    const extractSiteIdFromUrl = (url: string): string | undefined => {
      try {
        const u = new URL(url);
        const parts = u.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1];
      } catch {
        return undefined;
      }
    };

    // Build payload based on pharmacy type
    let payload: any;
    
    if (pharmacy.api_auth_type === "baremeds") {
      // Use standardized BareMeds payload builder
      const endpointSiteId = extractSiteIdFromUrl(pharmacy.api_endpoint_url);
      payload = createTestOrderPayload(endpointSiteId);
      
      console.log("[test-pharmacy-api] BareMeds FULL PAYLOAD:", JSON.stringify(payload, null, 2));
    } else {
      // Generic payload for other pharmacy types
      payload = {
        order_id: testOrderId,
        order_line_id: testLineId,
        vitaluxe_order_number: `TEST-${Date.now()}`,
        
        // Test patient info
        patient_name: "Test Patient (Please Ignore)",
        patient_address: "123 Test Street, Test City, CA 90001",
        patient_phone: "555-0100",
        patient_email: "test@example.com",
        
        // Shipping info
        ship_to: "patient",
        shipping_address: "123 Test Street, Test City, CA 90001",
        
        // Product info
        product: {
          name: "TEST PRODUCT - PLEASE IGNORE",
          quantity: 1,
          custom_sig: "Test instructions - do not process",
          custom_dosage: "1 tablet",
          notes: "THIS IS A TEST ORDER - DO NOT FULFILL",
        },
        prescription_url: null,
        shipping_speed: "ground",
        destination_state: "CA",
        
        // Provider credentials
        provider: {
          name: "Test Provider MD",
          npi: "1234567890",
          dea: "AT1234567",
          address: "456 Provider Ave, Test City, CA 90001",
          practice: "Test Practice",
        },
        
        created_at: testTimestamp,
        _test_order: true,
        _test_note: "This is a test order sent via the API configuration dialog. Please do not fulfill.",
      };
    }

    // Build auth headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Handle BareMeds using standardized token flow
    if (pharmacy.api_auth_type === "baremeds") {
      console.log("[test-pharmacy-api] Using BareMeds API with standardized token flow");
      
      try {
        // Step 1: Get authentication token
        console.log("[test-pharmacy-api] Requesting BareMeds token...");
        const tokenResponse = await supabaseAdmin.functions.invoke('baremeds-get-token', {
          body: { pharmacy_id: pharmacy.id }
        });

        if (tokenResponse.error || !tokenResponse.data?.token) {
          throw new Error(`Token retrieval failed: ${tokenResponse.error?.message || 'No token returned'}`);
        }

        const { token } = tokenResponse.data;
        console.log("[test-pharmacy-api] ✅ Token retrieved successfully");

        // Step 2: Extract endpoint path
        const endpointUrl = new URL(pharmacy.api_endpoint_url);
        const endpointPath = endpointUrl.pathname + endpointUrl.search;
        
        // Step 3: Make API call using simplified baremedsFetch
        console.log("[test-pharmacy-api] Sending test order to BareMeds...");
        const response = await baremedsFetch(endpointPath, payload, token, {
          method: 'POST',
        });

        // Step 4: Parse response
        const responseText = await response.text();
        let responseBody: any;
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          responseBody = { text: responseText };
        }

        // Step 5: Handle success/failure
        if (response.ok) {
          const pharmacyOrderId = responseBody.order_id || 
                                   responseBody.baremeds_order_id || 
                                   responseBody.id;
          
          console.log(`✅ Test order sent successfully. Pharmacy order ID: ${pharmacyOrderId || 'Not provided'}`);
          
          return new Response(
            JSON.stringify({ 
              success: true,
              message: "Test order sent successfully",
              test_order_id: testOrderId,
              pharmacy_order_id: pharmacyOrderId,
              response_status: response.status,
              response_body: responseBody,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        } else {
          console.error(`❌ Test order failed with status ${response.status}`);
          console.error(`Full BareMeds error response:`, JSON.stringify(responseBody, null, 2));
          console.error(`Payload that was sent:`, JSON.stringify(payload, null, 2));
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `HTTP ${response.status}: ${JSON.stringify(responseBody)}`,
              response_status: response.status,
              response_body: responseBody,
              sent_payload: payload,
              endpoint: endpointPath,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: response.status }
          );
        }
      } catch (error: any) {
        console.error("[test-pharmacy-api] ❌ BareMeds error:", error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error.message,
            sent_payload: payload,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    } else if (pharmacy.api_auth_type === "bearer" && credentials?.length) {
      const token = credentials.find(c => c.credential_type === "bearer_token")?.credential_key;
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } else if (pharmacy.api_auth_type === "api_key" && credentials?.length) {
      const apiKey = credentials.find(c => c.credential_type === "api_key")?.credential_key;
      const keyName = pharmacy.api_auth_key_name || "X-API-Key";
      if (apiKey) headers[keyName] = apiKey;
    } else if (pharmacy.api_auth_type === "basic" && credentials?.length) {
      const username = credentials.find(c => c.credential_type === "basic_auth_username")?.credential_key;
      const password = credentials.find(c => c.credential_type === "basic_auth_password")?.credential_key;
      if (username && password) {
        headers["Authorization"] = `Basic ${btoa(`${username}:${password}`)}`;
      }
    }

    // Send test order
    const timeout = (pharmacy.api_timeout_seconds || 30) * 1000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    console.log(`Sending test order to ${pharmacy.api_endpoint_url}`);

    const response = await fetch(pharmacy.api_endpoint_url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let responseBody: any;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = { text: await response.text() };
    }

    if (response.ok) {
      console.log(`Test order sent successfully`);
      
      // Extract pharmacy order ID from response if available
      let pharmacyOrderId = null;
      if (pharmacy.api_auth_type === "baremeds" && responseBody) {
        pharmacyOrderId = responseBody.order_id || 
                         responseBody.baremeds_order_id || 
                         responseBody.id;
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Test order sent successfully",
          test_order_id: testOrderId,
          pharmacy_order_id: pharmacyOrderId,
          response_status: response.status,
          response_body: responseBody,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Request failed
    console.error(`Test order failed with status ${response.status}`);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `HTTP ${response.status}: ${JSON.stringify(responseBody)}`,
        response_status: response.status,
        response_body: responseBody,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: response.status }
    );

  } catch (error) {
    console.error("Error in test-pharmacy-api:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
