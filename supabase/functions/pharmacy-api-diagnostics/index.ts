import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiagnosticStep {
  step: string;
  status: "success" | "warning" | "error";
  message: string;
  details?: any;
}

interface DiagnosticsRequest {
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

    const { pharmacy_id }: DiagnosticsRequest = await req.json();
    console.log(`[Diagnostics] Starting diagnostics for pharmacy ${pharmacy_id}`);

    const results: DiagnosticStep[] = [];

    // Step 1: Fetch pharmacy configuration
    const { data: pharmacy, error: pharmacyError } = await supabaseAdmin
      .from("pharmacies")
      .select("*")
      .eq("id", pharmacy_id)
      .single();

    if (pharmacyError || !pharmacy) {
      results.push({
        step: "Pharmacy Configuration",
        status: "error",
        message: "Failed to fetch pharmacy",
        details: pharmacyError?.message,
      });
      return new Response(
        JSON.stringify({ success: false, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    results.push({
      step: "Pharmacy Configuration",
      status: "success",
      message: "Pharmacy found",
      details: { name: pharmacy.practice_name, api_enabled: pharmacy.api_enabled },
    });

    // Step 2: Check API enabled
    if (!pharmacy.api_enabled) {
      results.push({
        step: "API Enabled Check",
        status: "error",
        message: "API integration is disabled",
        details: "Enable API integration in the Configuration tab",
      });
      return new Response(
        JSON.stringify({ success: false, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    results.push({
      step: "API Enabled Check",
      status: "success",
      message: "API integration is enabled",
    });

    // Step 3: Validate credentials based on auth type
    const { data: credentials } = await supabaseAdmin
      .from("pharmacy_api_credentials")
      .select("*")
      .eq("pharmacy_id", pharmacy_id);

    if (!pharmacy.api_endpoint_url) {
      results.push({
        step: "API Endpoint URL",
        status: "error",
        message: "No API endpoint URL configured",
      });
      return new Response(
        JSON.stringify({ success: false, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    results.push({
      step: "API Endpoint URL",
      status: "success",
      message: "API endpoint URL configured",
      details: { url: pharmacy.api_endpoint_url },
    });

    switch (pharmacy.api_auth_type) {
      case "bearer": {
        const hasToken = credentials?.some(c => c.credential_type === "bearer_token");
        if (!hasToken) {
          results.push({
            step: "API Credentials",
            status: "error",
            message: "No bearer token credentials found",
          });
          return new Response(
            JSON.stringify({ success: false, results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
        results.push({
          step: "API Credentials",
          status: "success",
          message: "Bearer token credentials configured",
        });
        break;
      }
      case "api_key": {
        const hasKey = credentials?.some(c => c.credential_type === "api_key");
        if (!hasKey) {
          results.push({
            step: "API Credentials",
            status: "error",
            message: "No API key credentials found",
          });
          return new Response(
            JSON.stringify({ success: false, results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
        results.push({
          step: "API Credentials",
          status: "success",
          message: "API key credentials configured",
        });
        break;
      }
      case "basic": {
        const hasUsername = credentials?.some(c => c.credential_type === "basic_auth_username");
        const hasPassword = credentials?.some(c => c.credential_type === "basic_auth_password");
        if (!hasUsername || !hasPassword) {
          results.push({
            step: "API Credentials",
            status: "error",
            message: "Basic auth credentials incomplete",
            details: {
              has_username: Boolean(hasUsername),
              has_password: Boolean(hasPassword),
            },
          });
          return new Response(
            JSON.stringify({ success: false, results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
        results.push({
          step: "API Credentials",
          status: "success",
          message: "Basic auth credentials configured",
        });
        break;
      }
      case "none":
      default:
        results.push({
          step: "API Credentials",
          status: "success",
          message: "No API credentials required",
        });
        break;
    }

    // All diagnostics passed
    console.log(`[Diagnostics] All checks passed for pharmacy ${pharmacy_id}`);
    return new Response(
      JSON.stringify({ 
        success: true,
        results,
        message: "All diagnostic checks passed",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("[Diagnostics] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error),
        results: [{
          step: "System Error",
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        }],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
