// ✅ Agora Token Endpoint v2.4 — hardened JSON parsing + defensive token generation
import { corsHeaders } from "../_shared/cors.ts";
import { Role, RtcTokenBuilder, RtmTokenBuilder } from "../_shared/agoraTokenBuilder.ts";

console.log("[agora-token] v2.4 initialized");

// v2.4 trigger redeploy - hardened JSON parsing, POST-only, defensive token generation
console.log("[agora-token] 🌀 Auto-deploy trigger: v2.4");

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
        version: "2.4",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    // 🔒 Parse POST JSON body only
    let body: any = {};
    try {
      if (req.method === "POST") {
        body = await req.json();
      } else {
        return err(405, "Method not allowed. Use POST with JSON body.", reqId);
      }
    } catch (jsonError) {
      return err(400, "Invalid JSON in request body.", reqId);
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

    // 🔑 Generate tokens with defensive error handling
    let rtcToken: string;
    let rtmToken: string;

    try {
      rtcToken = await RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCert,
        channel,
        uid,
        rtcRole,
        ttlSeconds,
        ttlSeconds,
      );
      rtmToken = await RtmTokenBuilder.buildToken(appId, appCert, String(uid), ttlSeconds);
    } catch (tokenError) {
      console.error("[agora-token] Token generation failed:", tokenError);
      return err(500, `Token generation failed: ${tokenError.message}`, reqId);
    }

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
