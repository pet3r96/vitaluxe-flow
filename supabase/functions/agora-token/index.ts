// ✅ Agora Token Endpoint v2.2 — robust health path & safe JSON parsing
// - /functions/v1/agora-token/health → simple deployment check
// - POST /functions/v1/agora-token (JSON) or GET with query params

import { corsHeaders } from "../_shared/cors.ts";
import { RtcRole, RtmRole, RtcTokenBuilder, RtmTokenBuilder } from "../_shared/agoraTokenService.ts";

console.log("[agora-token] init");

Deno.serve(async (req) => {
  const reqId = crypto.randomUUID();

  // Always handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // 👇 Handle /health BEFORE reading any body (fixes the JSON error)
  if (url.pathname.endsWith("/health")) {
    return new Response(
      JSON.stringify({
        ok: true,
        status: "healthy",
        version: "2.2",
        serverTime: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // ---- Input normalization (support POST JSON and GET query) ----
    let input: any = {};
    const isJson = (req.headers.get("content-type") || "").toLowerCase().includes("application/json");

    if (req.method === "POST" && isJson) {
      // Parse only if there is a non-empty body
      const contentLength = Number(req.headers.get("content-length") || "0");
      input = contentLength > 0 ? await req.json() : {};
    } else {
      // GET (or non-JSON POST) via query params
      input = {
        channel: url.searchParams.get("channel") ?? undefined,
        uid: url.searchParams.get("uid") ?? undefined,
        role: url.searchParams.get("role") ?? undefined,
        ttl: url.searchParams.get("ttl") ? Number(url.searchParams.get("ttl")) : undefined,
        // Back-compat param
        expireSeconds: url.searchParams.get("expireSeconds")
          ? Number(url.searchParams.get("expireSeconds"))
          : undefined,
      };
    }

    // Back-compat: accept expireSeconds or ttl
    const { channel, uid, role = "publisher", ttl, expireSeconds } = input || {};
    const ttlSeconds = Math.min(Math.max(Number(ttl ?? expireSeconds ?? 3600) || 3600, 60), 7200);

    // ---- Validation ----
    if (!channel || !/^[A-Za-z0-9_]{1,64}$/.test(channel)) {
      return jsonErr(400, "Invalid channel (letters, numbers, underscores; 1–64 chars).", reqId);
    }
    if (!uid) {
      return jsonErr(400, "Missing uid.", reqId);
    }
    const roleUpper = String(role).toUpperCase();
    const rtcRole = (RtcRole as any)[roleUpper] ?? RtcRole.PUBLISHER; // publisher/subscriber

    // ---- Env checks ----
    const appId = Deno.env.get("AGORA_APP_ID")?.trim();
    const appCert = Deno.env.get("AGORA_APP_CERTIFICATE")?.trim();
    if (!appId || !appCert) {
      return jsonErr(500, "Missing AGORA_APP_ID or AGORA_APP_CERTIFICATE.", reqId);
    }

    // ---- Build tokens ----
    const rtcToken = RtcTokenBuilder.buildTokenWithUid(appId, appCert, channel, uid, rtcRole, ttlSeconds);

    const rtmToken = RtmTokenBuilder.buildToken(appId, appCert, uid, RtmRole.Rtm_User, ttlSeconds);

    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

    return new Response(
      JSON.stringify({
        ok: true,
        appId,
        rtcToken,
        rtmToken,
        channel,
        uid,
        role: roleUpper.toLowerCase(),
        ttl: ttlSeconds,
        expiresAt,
        serverTime: Math.floor(Date.now() / 1000),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[agora-token] error", reqId, err);
    return jsonErr(500, err?.message ?? "Unknown error", reqId);
  }
});

function jsonErr(status: number, message: string, reqId: string) {
  return new Response(JSON.stringify({ ok: false, error: message, reqId }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
