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

    if (pharmacy.api_auth_type === "baremeds") {
      // BareMeds-specific validation
      const baremedsCred = credentials?.find(c => c.credential_type === "baremeds_oauth");
      
      if (!baremedsCred) {
        results.push({
          step: "BareMeds Credentials",
          status: "error",
          message: "BareMeds credentials not found",
          details: "Save BareMeds credentials first",
        });
        return new Response(
          JSON.stringify({ success: false, results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      try {
        let baremedsCreds = JSON.parse(baremedsCred.credential_key);
        
        // Handle double-encoded credentials
        if (typeof baremedsCreds === 'string') {
          baremedsCreds = JSON.parse(baremedsCreds);
        }

        // Normalize field names
        const normalized = {
          baseUrl: baremedsCreds.base_url || baremedsCreds.baseUrl || baremedsCreds.url || baremedsCreds.base,
          email: baremedsCreds.email || baremedsCreds.Email,
          password: baremedsCreds.password || baremedsCreds.Password,
          siteId: baremedsCreds.site_id || baremedsCreds.siteId || baremedsCreds.site,
        };

        const missing = [];
        if (!normalized.baseUrl) missing.push('base_url');
        if (!normalized.email) missing.push('email');
        if (!normalized.password) missing.push('password');
        if (!normalized.siteId) missing.push('site_id');

        if (missing.length > 0) {
          results.push({
            step: "BareMeds Credentials",
            status: "error",
            message: `Missing required fields: ${missing.join(', ')}`,
            details: { available_keys: Object.keys(baremedsCreds) },
          });
          return new Response(
            JSON.stringify({ success: false, results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }

        // Check for common typo: norders instead of rxorders
        if (normalized.baseUrl.includes("norders")) {
          results.push({
            step: "BareMeds Base URL",
            status: "warning",
            message: "Possible typo detected in Base URL",
            details: `URL contains "norders" - did you mean "rxorders"? Current: ${normalized.baseUrl}`,
          });
        }

        results.push({
          step: "BareMeds Credentials",
          status: "success",
          message: "All required fields present",
          details: { 
            baseUrl: normalized.baseUrl,
            email: normalized.email,
            siteId: normalized.siteId,
          },
        });

        // Step 4: Test BareMeds base URL reachability
        try {
          const baseUrlCheck = await fetch(normalized.baseUrl, {
            method: "HEAD",
            signal: AbortSignal.timeout(5000),
          });

          if (baseUrlCheck.ok || baseUrlCheck.status === 404 || baseUrlCheck.status === 405) {
            // 404/405 means server is reachable but endpoint doesn't exist for HEAD
            results.push({
              step: "Base URL Reachability",
              status: "success",
              message: `Base URL is reachable (HTTP ${baseUrlCheck.status})`,
              details: { url: normalized.baseUrl },
            });
          } else {
            results.push({
              step: "Base URL Reachability",
              status: "warning",
              message: `Unexpected status from base URL: ${baseUrlCheck.status}`,
              details: { url: normalized.baseUrl },
            });
          }
        } catch (error) {
          results.push({
            step: "Base URL Reachability",
            status: "error",
            message: "Cannot reach base URL",
            details: { url: normalized.baseUrl, error: error instanceof Error ? error.message : String(error) },
          });
          return new Response(
            JSON.stringify({ success: false, results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }

        // Step 5: Test BareMeds login
        try {
          const loginUrl = new URL('/api/auth/login', normalized.baseUrl).toString();
          const loginPayload = {
            email: normalized.email,
            password: normalized.password,
            site_id: normalized.siteId,
          };

          const loginResponse = await fetch(loginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loginPayload),
            signal: AbortSignal.timeout(10000),
          });

          if (!loginResponse.ok) {
            const errorText = await loginResponse.text();
            results.push({
              step: "BareMeds Login",
              status: "error",
              message: `Login failed with HTTP ${loginResponse.status}`,
              details: { 
                url: loginUrl,
                status: loginResponse.status,
                response: errorText.substring(0, 200),
              },
            });
            return new Response(
              JSON.stringify({ success: false, results }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
          }

          const loginData = await loginResponse.json();
          const token = loginData.token || loginData.access_token;

          if (!token) {
            results.push({
              step: "BareMeds Login",
              status: "error",
              message: "Login succeeded but no token received",
              details: { response_keys: Object.keys(loginData) },
            });
            return new Response(
              JSON.stringify({ success: false, results }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
          }

          results.push({
            step: "BareMeds Login",
            status: "success",
            message: "Login successful, token received",
            details: { 
              token_preview: `${token.substring(0, 10)}...${token.substring(token.length - 10)}`,
              token_length: token.length,
            },
          });

          // Step 6: Validate API endpoint URL if provided
          if (pharmacy.api_endpoint_url) {
            try {
              const endpointUrl = new URL(pharmacy.api_endpoint_url);
              
              // Check if endpoint hostname matches base URL hostname
              const baseUrlObj = new URL(normalized.baseUrl);
              if (endpointUrl.hostname !== baseUrlObj.hostname) {
                results.push({
                  step: "API Endpoint Validation",
                  status: "warning",
                  message: "Endpoint hostname doesn't match base URL",
                  details: {
                    endpoint_host: endpointUrl.hostname,
                    base_url_host: baseUrlObj.hostname,
                  },
                });
              } else {
                results.push({
                  step: "API Endpoint Validation",
                  status: "success",
                  message: "API endpoint URL is valid",
                  details: { url: pharmacy.api_endpoint_url },
                });
              }

              // Step 7: Test endpoint with OPTIONS (if supported)
              try {
                const optionsResponse = await fetch(pharmacy.api_endpoint_url, {
                  method: "OPTIONS",
                  signal: AbortSignal.timeout(5000),
                });

                results.push({
                  step: "Endpoint OPTIONS Check",
                  status: optionsResponse.ok ? "success" : "warning",
                  message: `Endpoint responded to OPTIONS with HTTP ${optionsResponse.status}`,
                  details: { 
                    allows_cors: optionsResponse.headers.get("Access-Control-Allow-Origin") ? "yes" : "no",
                  },
                });
              } catch (error) {
                results.push({
                  step: "Endpoint OPTIONS Check",
                  status: "warning",
                  message: "Endpoint did not respond to OPTIONS (may not be supported)",
                  details: { error: error instanceof Error ? error.message : String(error) },
                });
              }

            } catch (error) {
              results.push({
                step: "API Endpoint Validation",
                status: "error",
                message: "Invalid API endpoint URL format",
                details: { url: pharmacy.api_endpoint_url, error: error instanceof Error ? error.message : String(error) },
              });
            }
          }

        } catch (error) {
          results.push({
            step: "BareMeds Login",
            status: "error",
            message: "Login request failed",
            details: { error: error instanceof Error ? error.message : String(error) },
          });
          return new Response(
            JSON.stringify({ success: false, results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }

      } catch (error) {
        results.push({
          step: "BareMeds Credentials",
          status: "error",
          message: "Failed to parse credentials",
          details: { error: error instanceof Error ? error.message : String(error) },
        });
        return new Response(
          JSON.stringify({ success: false, results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

    } else {
      // Non-BareMeds auth types
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

      // Check credentials based on auth type
      if (pharmacy.api_auth_type !== "none") {
        const credType = pharmacy.api_auth_type === "bearer" ? "bearer_token" : "api_key";
        const hasCreds = credentials?.some(c => c.credential_type === credType);

        if (!hasCreds) {
          results.push({
            step: "API Credentials",
            status: "error",
            message: `No ${pharmacy.api_auth_type} credentials found`,
          });
          return new Response(
            JSON.stringify({ success: false, results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }

        results.push({
          step: "API Credentials",
          status: "success",
          message: `${pharmacy.api_auth_type} credentials configured`,
        });
      }
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
