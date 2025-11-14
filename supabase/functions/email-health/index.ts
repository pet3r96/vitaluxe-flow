import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Email Health Check Endpoint
 * Tests email system configuration and connectivity
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {},
    postmarkStatus: "unknown",
    errors: [],
    warnings: []
  };

  try {
    // Check environment variables
    const POSTMARK_API_KEY = Deno.env.get("POSTMARK_API_KEY");
    const POSTMARK_FROM_EMAIL = Deno.env.get("POSTMARK_FROM_EMAIL");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

    diagnostics.environment = {
      hasPostmarkKey: !!POSTMARK_API_KEY,
      hasFromEmail: !!POSTMARK_FROM_EMAIL,
      fromEmail: POSTMARK_FROM_EMAIL || "not set",
      hasSupabaseUrl: !!SUPABASE_URL,
      supabaseUrl: SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + "..." : "not set"
    };

    if (!POSTMARK_API_KEY) {
      diagnostics.errors.push("POSTMARK_API_KEY is not configured");
      diagnostics.postmarkStatus = "misconfigured";
    } else {
      // Test Postmark API connectivity (dry run)
      try {
        const testResponse = await fetch("https://api.postmarkapp.com/server", {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "X-Postmark-Server-Token": POSTMARK_API_KEY,
          },
        });

        if (testResponse.ok) {
          const serverInfo = await testResponse.json();
          diagnostics.postmarkStatus = "healthy";
          diagnostics.postmarkServer = {
            name: serverInfo.Name,
            color: serverInfo.Color,
            senderSignatureId: serverInfo.InboundHookUrl ? "configured" : "not configured"
          };
        } else {
          const errorText = await testResponse.text();
          diagnostics.postmarkStatus = "api_error";
          diagnostics.errors.push(`Postmark API returned ${testResponse.status}: ${errorText}`);
        }
      } catch (apiError: any) {
        diagnostics.postmarkStatus = "connection_failed";
        diagnostics.errors.push(`Failed to connect to Postmark: ${apiError.message}`);
      }
    }

    // Check recent email activity
    diagnostics.recentActivity = {
      message: "Check edge function logs for send-welcome-email, send-password-reset-email, send-verification-email"
    };

    // Overall status
    diagnostics.overallStatus = diagnostics.errors.length === 0 ? "healthy" : "degraded";
    diagnostics.recommendation = diagnostics.errors.length === 0
      ? "Email system is configured correctly"
      : "Fix the errors listed above";

    return new Response(
      JSON.stringify(diagnostics, null, 2),
      {
        status: diagnostics.errors.length === 0 ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[email-health] Critical error:", error);
    return new Response(
      JSON.stringify({
        error: "Health check failed",
        message: error.message,
        diagnostics
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
