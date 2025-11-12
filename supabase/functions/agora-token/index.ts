// ✅ Agora Token Endpoint v2.3 — safe /health handler + clean JSON parsing
import { corsHeaders } from "../_shared/cors.ts";
import { Role, RtcTokenBuilder, RtmTokenBuilder } from "../_shared/agoraTokenBuilder.ts";

console.log("[agora-token] v2.3 initialized");

// v2.3 trigger redeploy - added health check + debug logging
console.log("[agora-token] 🌀 Auto-deploy trigger: v2.3");

Deno.serve(async (req) => {
  const reqId = crypto.randomUUID();
  const url = new URL(req.url);

  // ✅ Always handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ✅ Handle /health before touching body
  if (url.pathname.includes("health")) {
    return new Response(
      JSON.stringify({
        ok: true,
        status: "healthy",
        version: "2.3",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    // 🔒 Parse input safely (POST JSON or GET params)
    let body: any = {};
    const contentType = req.headers.get("content-type") || "";
    if (req.method === "POST" && contentType.toLowerCase().includes("application/json")) {
      const raw = await req.text();
      body = raw ? JSON.parse(raw) : {};
    } else {
      body = Object.fromEntries(new URL(req.url).searchParams.entries());
    }

    const { channel, uid, role = "publisher", ttl, expireSeconds } = body;
    const ttlSeconds = Math.min(Math.max(Number(ttl ?? expireSeconds ?? 3600), 60), 7200);

    // 🧠 Validate required fields
    if (!channel || !/^[A-Za-z0-9_]{1,64}$/.test(channel)) {
      return err(400, "Invalid or missing channel name.", reqId);
    }
    if (!uid) return err(400, "Missing uid.", reqId);

    // 🔑 Load environment
    const appId = Deno.env.get("AGORA_APP_ID")?.trim();
    const appCert = Deno.env.get("AGORA_APP_CERTIFICATE")?.trim();
    if (!appId || !appCert) return err(500, "Missing AGORA_APP_ID or AGORA_APP_CERTIFICATE.", reqId);

    const rtcRole = role.toUpperCase() === "SUBSCRIBER" ? Role.SUBSCRIBER : Role.PUBLISHER;

    const rtcToken = await RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCert,
      channel,
      uid,
      rtcRole,
      ttlSeconds,
      ttlSeconds,
    );
    const rtmToken = await RtmTokenBuilder.buildToken(appId, appCert, String(uid), ttlSeconds);

    return new Response(
      JSON.stringify({
        ok: true,
        appId,
        rtcToken,
        rtmToken,
        channel,
        uid,
        role,
        ttl: ttlSeconds,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[agora-token]", reqId, error);
    return err(500, error.message, reqId);
  }
});

function err(status: number, message: string, reqId: string) {
  return new Response(JSON.stringify({ ok: false, error: message, reqId }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
