/**
 * Test VIOS API Edge Function - Tests connection and returns status
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { edgeLogger } from '../_shared/logger.ts';
import { isViosEnabled, getViosConnectionStatus, clearViosTokenCache, getViosToken, VIOS_API_URL } from '../_shared/vios/index.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isViosEnabled()) {
    return new Response(
      JSON.stringify({ success: false, enabled: false, error: "VIOS integration disabled", code: "VIOS_DISABLED" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    let action = 'status';
    if (req.method === 'POST') {
      try { action = (await req.json()).action || 'status'; } catch {}
    }

    if (action === 'refresh') {
      clearViosTokenCache();
      await getViosToken();
    }

    const status = await getViosConnectionStatus();
    const hasClientId = !!Deno.env.get("VIOS_CLIENT_ID");
    const hasClientSecret = !!Deno.env.get("VIOS_CLIENT_SECRET");

    return new Response(
      JSON.stringify({
        success: status.connected,
        enabled: true,
        api_url: VIOS_API_URL,
        credentials: { client_id_configured: hasClientId, client_secret_configured: hasClientSecret },
        connection: status
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    edgeLogger.error("VIOS test error", error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ success: false, enabled: true, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
