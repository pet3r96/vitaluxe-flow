import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Test Email Sending - End-to-End Test
 * Tests all email types: verification, welcome, reset, portal_access
 */
serve(async (req: Request) => {
  console.log('🧪 [test-email-sending] Function START');
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { testEmail, emailType = "all" } = await req.json();

    if (!testEmail) {
      return new Response(
        JSON.stringify({ error: "testEmail is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any = {
      testEmail,
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Generate test user data
    const testUserId = crypto.randomUUID();
    const testName = "Test User";

    // Test 1: Password Reset Email
    if (emailType === "all" || emailType === "reset") {
      console.log('🧪 Testing password reset email...');
      try {
        const { data, error } = await supabaseAdmin.functions.invoke('send-password-reset-email', {
          body: { email: testEmail }
        });

        results.tests.push({
          type: "password_reset",
          status: error ? "failed" : "success",
          error: error?.message,
          data: data
        });
      } catch (err: any) {
        results.tests.push({
          type: "password_reset",
          status: "exception",
          error: err.message
        });
      }
    }

    // Test 2: Verification Email
    if (emailType === "all" || emailType === "verification") {
      console.log('🧪 Testing verification email...');
      try {
        const { data, error } = await supabaseAdmin.functions.invoke('send-verification-email', {
          body: {
            userId: testUserId,
            email: testEmail,
            name: testName
          }
        });

        results.tests.push({
          type: "verification",
          status: error ? "failed" : "success",
          error: error?.message,
          data: data
        });
      } catch (err: any) {
        results.tests.push({
          type: "verification",
          status: "exception",
          error: err.message
        });
      }
    }

    // Test 3: Welcome Email
    if (emailType === "all" || emailType === "welcome") {
      console.log('🧪 Testing welcome email...');
      try {
        const { data, error } = await supabaseAdmin.functions.invoke('send-welcome-email', {
          body: {
            userId: testUserId,
            email: testEmail,
            name: testName,
            role: "doctor"
          }
        });

        results.tests.push({
          type: "welcome",
          status: error ? "failed" : "success",
          error: error?.message,
          data: data
        });
      } catch (err: any) {
        results.tests.push({
          type: "welcome",
          status: "exception",
          error: err.message
        });
      }
    }

    // Test 4: Email Dispatcher
    if (emailType === "all" || emailType === "dispatcher") {
      console.log('🧪 Testing email dispatcher...');
      try {
        const { data, error } = await supabaseAdmin.functions.invoke('email-dispatcher', {
          body: {
            type: 'reset',
            userId: testUserId,
            email: testEmail,
            name: testName,
            correlationId: crypto.randomUUID()
          }
        });

        results.tests.push({
          type: "email_dispatcher",
          status: error ? "failed" : "success",
          error: error?.message,
          data: data
        });
      } catch (err: any) {
        results.tests.push({
          type: "email_dispatcher",
          status: "exception",
          error: err.message
        });
      }
    }

    // Summary
    const successCount = results.tests.filter((t: any) => t.status === "success").length;
    const failCount = results.tests.filter((t: any) => t.status !== "success").length;
    
    results.summary = {
      total: results.tests.length,
      successful: successCount,
      failed: failCount,
      overallStatus: failCount === 0 ? "all_passing" : "some_failures"
    };

    console.log('🧪 [test-email-sending] Test complete:', results.summary);

    return new Response(
      JSON.stringify(results, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("❌ [test-email-sending] Critical error:", error);
    return new Response(
      JSON.stringify({
        error: "Test failed",
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
