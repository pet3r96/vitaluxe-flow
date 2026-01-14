import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

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
  include_vios_token_test?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();

    const { pharmacy_id, include_vios_token_test }: DiagnosticsRequest = await req.json();
    edgeLogger.info('[Diagnostics] Starting diagnostics for pharmacy', { pharmacyId: pharmacy_id, includeViosTokenTest: include_vios_token_test });

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
        // VIOS uses OAuth client credentials, not static bearer token
        if (pharmacy.api_handler_type === 'vios') {
          const hasClientKey = credentials?.some(c => c.credential_type === "vios_client_key");
          const hasClientSecret = credentials?.some(c => c.credential_type === "vios_client_secret");
          // Also check environment variables
          const envClientId = Deno.env.get('VIOS_CLIENT_ID');
          const envClientSecret = Deno.env.get('VIOS_CLIENT_SECRET');
          const hasEnvCredentials = !!(envClientId && envClientSecret);
          
          if (!hasEnvCredentials && (!hasClientKey || !hasClientSecret)) {
            results.push({
              step: "API Credentials",
              status: "error",
              message: "VIOS OAuth credentials incomplete",
              details: {
                has_client_key: Boolean(hasClientKey),
                has_client_secret: Boolean(hasClientSecret),
                has_env_credentials: hasEnvCredentials,
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
            message: hasEnvCredentials ? "VIOS OAuth credentials configured (env)" : "VIOS OAuth credentials configured",
            details: { source: hasEnvCredentials ? "environment" : "database" },
          });
        } else {
          // Standard bearer token check for non-VIOS
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
        }
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

    // Step: VIOS Token Test (if requested and VIOS handler)
    if (include_vios_token_test && pharmacy.api_handler_type === 'vios') {
      const baseUrl = pharmacy.api_endpoint_url?.replace(/\/+$/, '') || 'https://integrations.vioscompounding.com';
      
      // Check environment variables first
      const envClientId = Deno.env.get('VIOS_CLIENT_ID');
      const envClientSecret = Deno.env.get('VIOS_CLIENT_SECRET');
      
      let clientId = envClientId;
      let clientSecret = envClientSecret;
      
      // If no env vars, decrypt credentials from database
      if (!envClientId || !envClientSecret) {
        try {
          const { data: decryptedCreds, error: decryptError } = await supabaseAdmin
            .rpc('decrypt_pharmacy_credentials_batch', { p_pharmacy_id: pharmacy_id });
          
          if (decryptError) {
            edgeLogger.error('[Diagnostics] Failed to decrypt credentials', { error: decryptError.message });
          } else if (decryptedCreds && Array.isArray(decryptedCreds)) {
            const clientKeyRecord = decryptedCreds.find((c: any) => c.credential_type === 'vios_client_key');
            const clientSecretRecord = decryptedCreds.find((c: any) => c.credential_type === 'vios_client_secret');
            clientId = clientKeyRecord?.credential_key || null;
            clientSecret = clientSecretRecord?.credential_key || null;
          }
        } catch (decryptErr) {
          edgeLogger.error('[Diagnostics] Error decrypting credentials', { error: decryptErr });
        }
      }
      
      if (!clientId || !clientSecret) {
        results.push({
          step: "VIOS Token Exchange",
          status: "error",
          message: "Missing VIOS credentials for token test",
          details: { hasClientId: !!clientId, hasClientSecret: !!clientSecret }
        });
      } else {
        try {
          const tokenUrl = `${baseUrl}/api/auth/token`;
          const startTime = Date.now();
          
          const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'ClientId': clientId,
              'ClientSecret': clientSecret
            }
          });
          
          const duration = Date.now() - startTime;
          
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            if (tokenData.accessToken) {
              results.push({
                step: "VIOS Token Exchange",
                status: "success",
                message: "Successfully obtained VIOS JWT token",
                details: { 
                  tokenLength: tokenData.accessToken.length,
                  durationMs: duration,
                  usingEnvVars: !!(envClientId && envClientSecret)
                }
              });
            } else {
              results.push({
                step: "VIOS Token Exchange",
                status: "error",
                message: "Token response missing accessToken",
                details: { responseKeys: Object.keys(tokenData) }
              });
            }
          } else {
            const errorText = await tokenResponse.text();
            results.push({
              step: "VIOS Token Exchange",
              status: "error",
              message: `VIOS auth failed (${tokenResponse.status})`,
              details: { error: errorText.substring(0, 200) }
            });
          }
        } catch (tokenError) {
          results.push({
            step: "VIOS Token Exchange",
            status: "error",
            message: "Failed to connect to VIOS auth endpoint",
            details: { error: tokenError instanceof Error ? tokenError.message : String(tokenError) }
          });
        }
      }
      
      // Check if all steps passed including VIOS token
      const hasErrors = results.some(r => r.status === 'error');
      if (hasErrors) {
        return new Response(
          JSON.stringify({ success: false, results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // All diagnostics passed
    edgeLogger.info('Diagnostics all checks passed', { pharmacyId: pharmacy_id });
    return new Response(
      JSON.stringify({ 
        success: true,
        results,
        message: "All diagnostic checks passed",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    edgeLogger.error("Diagnostics error", error);
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
