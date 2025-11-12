import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

// We reuse our existing Web Crypto builder
// (_shared/agoraTokenBuilder.ts must exist in this repo)
import { buildRtcToken, buildRtmToken, Role } from "../_shared/agoraTokenBuilder.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channel, uid, role = "publisher", ttl, expireSeconds } = await req.json();
    if (!channel || !uid) {
      return new Response(JSON.stringify({ error: "channel and uid are required" }), { status: 400, headers: corsHeaders });
    }

    const appId = (Deno.env.get("AGORA_APP_ID") ?? "").trim();
    const appCert = (Deno.env.get("AGORA_APP_CERTIFICATE") ?? "").trim();
    if (!appId || !appCert) {
      return new Response(JSON.stringify({ error: "Missing AGORA_APP_ID/AGORA_APP_CERTIFICATE" }), { status: 500, headers: corsHeaders });
    }

    // Accept both ttl and expireSeconds for backward compatibility
    const expiry = ttl || expireSeconds || 3600;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + Math.max(60, Math.min(Number(expiry), 7200)); // 1–120 min

    const rtcToken = await buildRtcToken(
      appId,
      appCert,
      channel,
      String(uid),
      (String(role).toLowerCase() === "publisher" ? Role.PUBLISHER : Role.SUBSCRIBER),
      expiresAt
    );

    // Generate RTM token
    const rtmToken = await buildRtmToken(appId, appCert, String(uid), expiresAt);

    return new Response(JSON.stringify({
      ok: true,
      appId,
      rtcToken,
      rtmToken,
      channel,
      uid: String(uid),
      role: String(role).toLowerCase(),
      expiresAt
    }), { headers: corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
