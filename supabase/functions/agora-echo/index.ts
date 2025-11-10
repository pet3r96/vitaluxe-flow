import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAgoraCredentials } from "../_shared/agoraTokens.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appId, appCertificate } = getAgoraCredentials();

    // Check raw bytes for hidden characters
    const rawAppId = Deno.env.get("AGORA_APP_ID") || "";
    const rawCert = Deno.env.get("AGORA_APP_CERTIFICATE") || "";
    console.log("[agora-echo] AppID raw bytes:", Array.from(new TextEncoder().encode(rawAppId)));
    console.log("[agora-echo] AppID length:", rawAppId.length);
    console.log("[agora-echo] Cert raw bytes prefix:", Array.from(new TextEncoder().encode(rawCert)).slice(0, 16));

    // Attempt Agora public API probe (may return 403/404 depending on policy)
    try {
      const res = await fetch(`https://api.agora.io/v1/apps/${appId}`);
      const body = await res.text();
      console.log("[agora-echo] Agora API status:", res.status);
      console.log("[agora-echo] Agora API body prefix:", body.substring(0, 120));
    } catch (probeErr) {
      console.log("[agora-echo] Agora API fetch error:", (probeErr as any)?.message || String(probeErr));
    }
    
    // Accept optional params from query string or body
    let channelName = 'test-channel';
    let uid = 'test-user';
    
    if (req.method === 'POST') {
      try {
        const text = await req.text();
        if (text && text.trim()) {
          const body = JSON.parse(text);
          channelName = body.channelName || channelName;
          uid = body.uid || uid;
        }
      } catch (jsonError) {
        console.log("[agora-echo] No JSON body provided, using defaults");
      }
    }

    console.log("[agora-echo] Debug diagnostics");

    return new Response(
      JSON.stringify({
        appId,
        appIdSample: appId.substring(0, 8) + '...',
        cert8: appCertificate.substring(0, 8),
        channelName,
        uid,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("[agora-echo] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to retrieve credentials',
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
