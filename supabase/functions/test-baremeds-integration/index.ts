import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { baremedsFetch } from "../_shared/baremedsFetch.ts";
import { createTestOrderPayload } from "../_shared/baremedsPayloads.ts";
import { extractSiteIdFromUrl, isRetryableStatusCode, calculateBackoffDelay } from "../_shared/baremedsUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestRequest {
  pharmacy_id?: string; // Optional: test specific pharmacy
  run_all_tests?: boolean; // Run full test suite
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

    const { pharmacy_id, run_all_tests = true }: TestRequest = await req.json();

    const testResults = {
      timestamp: new Date().toISOString(),
      tests_run: 0,
      tests_passed: 0,
      tests_failed: 0,
      details: [] as any[],
    };

    // Test 1: Utility Functions
    if (run_all_tests) {
      console.log("[Test Suite] Running utility function tests...");
      
      // Test extractSiteIdFromUrl
      const urlTests = [
        { url: "https://example.com/api/site/123/orders", expected: "123" },
        { url: "https://example.com/api/orders?site_id=456", expected: "456" },
        { url: "https://example.com/789/api/orders", expected: "789" },
      ];
      
      let utilityTestsPassed = 0;
      for (const test of urlTests) {
        const result = extractSiteIdFromUrl(test.url);
        if (result === test.expected) {
          utilityTestsPassed++;
        } else {
          testResults.details.push({
            test: "extractSiteIdFromUrl",
            url: test.url,
            expected: test.expected,
            actual: result,
            passed: false,
          });
        }
      }
      
      testResults.tests_run += urlTests.length;
      testResults.tests_passed += utilityTestsPassed;
      testResults.tests_failed += (urlTests.length - utilityTestsPassed);
      
      // Test isRetryableStatusCode
      const statusTests = [
        { status: 200, expected: false },
        { status: 400, expected: false },
        { status: 429, expected: true },
        { status: 500, expected: true },
        { status: 503, expected: true },
      ];
      
      let statusTestsPassed = 0;
      for (const test of statusTests) {
        const result = isRetryableStatusCode(test.status);
        if (result === test.expected) {
          statusTestsPassed++;
        } else {
          testResults.details.push({
            test: "isRetryableStatusCode",
            status: test.status,
            expected: test.expected,
            actual: result,
            passed: false,
          });
        }
      }
      
      testResults.tests_run += statusTests.length;
      testResults.tests_passed += statusTestsPassed;
      testResults.tests_failed += (statusTests.length - statusTestsPassed);
      
      // Test calculateBackoffDelay
      const backoffTest = calculateBackoffDelay(2, 1000, 30000);
      const expectedBackoff = 4000; // 1000 * 2^2
      testResults.tests_run++;
      if (backoffTest === expectedBackoff) {
        testResults.tests_passed++;
      } else {
        testResults.tests_failed++;
        testResults.details.push({
          test: "calculateBackoffDelay",
          expected: expectedBackoff,
          actual: backoffTest,
          passed: false,
        });
      }
    }

    // Test 2: Payload Builder
    if (run_all_tests) {
      console.log("[Test Suite] Testing payload builder...");
      
      const payload = createTestOrderPayload("123");
      testResults.tests_run++;
      
      const requiredFields = [
        'patient',
        'prescriber',
        'medication',
        'shipping',
        'external_order_id'
      ];
      
      const missingFields = requiredFields.filter(field => !(field in payload));
      
      if (missingFields.length === 0 && payload.site_id === "123") {
        testResults.tests_passed++;
        testResults.details.push({
          test: "createTestOrderPayload",
          passed: true,
          payload_size: JSON.stringify(payload).length,
        });
      } else {
        testResults.tests_failed++;
        testResults.details.push({
          test: "createTestOrderPayload",
          passed: false,
          missing_fields: missingFields,
          site_id: payload.site_id,
        });
      }
    }

    // Test 3: Token Retrieval (if pharmacy_id provided)
    if (pharmacy_id) {
      console.log(`[Test Suite] Testing token retrieval for pharmacy ${pharmacy_id}...`);
      
      testResults.tests_run++;
      
      try {
        const tokenResponse = await supabaseAdmin.functions.invoke('baremeds-get-token', {
          body: { pharmacy_id }
        });

        if (tokenResponse.error) {
          testResults.tests_failed++;
          testResults.details.push({
            test: "baremeds-get-token",
            pharmacy_id,
            passed: false,
            error: tokenResponse.error.message,
          });
        } else if (tokenResponse.data?.token) {
          testResults.tests_passed++;
          testResults.details.push({
            test: "baremeds-get-token",
            pharmacy_id,
            passed: true,
            token_length: tokenResponse.data.token.length,
          });
        } else {
          testResults.tests_failed++;
          testResults.details.push({
            test: "baremeds-get-token",
            pharmacy_id,
            passed: false,
            error: "No token in response",
          });
        }
      } catch (error: any) {
        testResults.tests_failed++;
        testResults.details.push({
          test: "baremeds-get-token",
          pharmacy_id,
          passed: false,
          error: error.message,
        });
      }
    }

    // Test 4: DryRun Mode (if pharmacy_id provided)
    if (pharmacy_id) {
      console.log(`[Test Suite] Testing dryRun mode for pharmacy ${pharmacy_id}...`);
      
      testResults.tests_run++;
      
      try {
        const testResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/test-pharmacy-api?dryRun=true`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ pharmacy_id }),
          }
        );

        const dryRunResult = await testResponse.json();
        
        if (testResponse.ok && dryRunResult.dry_run === true) {
          testResults.tests_passed++;
          testResults.details.push({
            test: "dryRun mode",
            pharmacy_id,
            passed: true,
            response_status: testResponse.status,
          });
        } else {
          testResults.tests_failed++;
          testResults.details.push({
            test: "dryRun mode",
            pharmacy_id,
            passed: false,
            response_status: testResponse.status,
            response_body: dryRunResult,
          });
        }
      } catch (error: any) {
        testResults.tests_failed++;
        testResults.details.push({
          test: "dryRun mode",
          pharmacy_id,
          passed: false,
          error: error.message,
        });
      }
    }

    const success = testResults.tests_failed === 0;
    
    return new Response(
      JSON.stringify({
        success,
        message: success 
          ? "All tests passed ✅" 
          : `${testResults.tests_failed} test(s) failed ❌`,
        ...testResults,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: success ? 200 : 500,
      }
    );

  } catch (error) {
    console.error("Error in test suite:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
