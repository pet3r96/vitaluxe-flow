import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Role, RtcTokenBuilder, RtmTokenBuilder } from "../_shared/agoraTokenBuilder.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  // Health check endpoint
  if (url.pathname.endsWith('/health')) {
    return new Response(
      JSON.stringify({ ok: true, status: "healthy", service: "agora-token" }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { channel, role = "subscriber", ttl = 3600 } = await req.json();

    console.log("[Edge] Token request received:", { channel, role });

    if (!channel || typeof channel !== "string" || !channel.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid or missing channel name." }),
        { status: 400 }
      );
    }

    const appId = Deno.env.get("AGORA_APP_ID");
    const appCert = Deno.env.get("AGORA_APP_CERTIFICATE");

    const uid = Math.floor(Math.random() * 99999999).toString();
    const rtmUid = `rtm_${uid}`;

    const rtcRole = role === "publisher" ? Role.PUBLISHER : Role.SUBSCRIBER;

    const expire = ttl;

    const rtcToken = await RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCert,
      channel,
      uid,
      rtcRole,
      expire,
      expire
    );

    const rtmToken = await RtmTokenBuilder.buildToken(
      appId,
      appCert,
      rtmUid,
      expire
    );

    return new Response(
      JSON.stringify({
        ok: true,
        rtcToken,
        rtmToken,
        uid,
        rtmUid,
        ttl,
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error("[Edge] ERROR:", err);
    return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
