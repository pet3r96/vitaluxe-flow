import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { getViosCredentials, getViosToken } from '../_shared/viosApi.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateCredentialsRequest {
  pharmacy_id: string;
}

interface ValidationResult {
  success: boolean;
  credentialSource: 'environment' | 'database' | null;
  tokenObtained: boolean;
  tokenLength?: number;
  durationMs?: number;
  error?: string;
  errorDetails?: {
    statusCode?: number;
    possibleCauses?: string[];
    recommendation?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const { pharmacy_id }: ValidateCredentialsRequest = await req.json();

    if (!pharmacy_id) {
      return new Response(
        JSON.stringify({ success: false, error: "pharmacy_id is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    edgeLogger.info('[VIOS Validate] Starting credential validation', { pharmacyId: pharmacy_id });

    // Get credentials using shared utility
    const credentials = await getViosCredentials(supabaseAdmin, pharmacy_id);

    if (!credentials) {
      const result: ValidationResult = {
        success: false,
        credentialSource: null,
        tokenObtained: false,
        error: "VIOS credentials not found",
        errorDetails: {
          possibleCauses: [
            "Environment variables VIOS_CLIENT_ID and VIOS_CLIENT_SECRET not set",
            "Database credentials not configured for this pharmacy",
            "Pharmacy is not configured for VIOS API"
          ],
          recommendation: "Configure VIOS credentials in backend secrets or pharmacy settings"
        }
      };
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Determine credential source
    const envClientId = Deno.env.get('VIOS_CLIENT_ID');
    const envClientSecret = Deno.env.get('VIOS_CLIENT_SECRET');
    const credentialSource = (envClientId && envClientSecret) ? 'environment' : 'database';

    // Attempt token exchange
    const startTime = Date.now();
    try {
      const token = await getViosToken(credentials);
      const durationMs = Date.now() - startTime;

      edgeLogger.info('[VIOS Validate] Token obtained successfully', { 
        pharmacyId: pharmacy_id, 
        durationMs,
        tokenLength: token.length 
      });

      const result: ValidationResult = {
        success: true,
        credentialSource,
        tokenObtained: true,
        tokenLength: token.length,
        durationMs
      };

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );

    } catch (tokenError) {
      const durationMs = Date.now() - startTime;
      const errorMessage = tokenError instanceof Error ? tokenError.message : String(tokenError);
      
      edgeLogger.error('[VIOS Validate] Token exchange failed', { 
        pharmacyId: pharmacy_id, 
        error: errorMessage,
        durationMs 
      });

      // Parse status code from error message if present
      const statusMatch = errorMessage.match(/\((\d{3})\)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;

      let possibleCauses: string[] = [];
      let recommendation = "";

      if (statusCode === 401) {
        possibleCauses = [
          "Credentials may be expired",
          "Credentials may be for wrong environment (sandbox vs production)",
          "Credentials may have been revoked or regenerated",
          "Client ID or Secret may contain typos"
        ];
        recommendation = "Regenerate credentials in VIOS Integration Portal (https://integrations-portal.vioscompounding.com) and update backend secrets";
      } else if (statusCode === 403) {
        possibleCauses = ["Account may not have API access enabled"];
        recommendation = "Contact VIOS to verify account permissions and API access";
      } else if (!statusCode) {
        possibleCauses = ["Network connectivity issue", "VIOS API may be down"];
        recommendation = "Check network connectivity and try again. If issue persists, contact VIOS support.";
      }

      const result: ValidationResult = {
        success: false,
        credentialSource,
        tokenObtained: false,
        durationMs,
        error: errorMessage,
        errorDetails: {
          statusCode,
          possibleCauses,
          recommendation
        }
      };

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

  } catch (error) {
    edgeLogger.error('[VIOS Validate] Unexpected error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});