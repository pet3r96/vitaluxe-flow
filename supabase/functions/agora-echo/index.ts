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
    
    // Accept optional params from query string or body
    let channelName = 'test-channel';
    let uid = 'test-user';
    
    if (req.method === 'POST') {
      const body = await req.json();
      channelName = body.channelName || channelName;
      uid = body.uid || uid;
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
