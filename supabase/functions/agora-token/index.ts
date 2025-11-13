// supabase/functions/agora-token/index.ts
// --------------------------------------------------------
// VITALUXE — AGORA TOKEN SERVICE (FULL PATCHED VERSION)
// --------------------------------------------------------

import {
  serve,
} from "https://deno.land/std@0.177.0/http/server.ts";

import {
  RtcRole,
  RtcTokenBuilder,
  RtmRole,
  RtmTokenBuilder,
} from "https://esm.sh/agora-token@2.0.4";

// --------------------------------------------------------
// 0. CORS Headers
// --------------------------------------------------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --------------------------------------------------------
// 1. Central Channel Normalizer
//    (MUST match frontend normalizeChannel.ts 1:1)
// --------------------------------------------------------
function normalizeChannel(raw: string): string {
  if (!raw) return "vlx_invalid";

  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "_");

  if (cleaned.startsWith("vlx_")) return cleaned;

  return `vlx_${cleaned}`;
}

// --------------------------------------------------------
// 2. Secrets (App ID + Certificate)
// --------------------------------------------------------
const APP_ID = Deno.env.get("AGORA_APP_ID");
const APP_CERT = Deno.env.get("AGORA_APP_CERTIFICATE");

// --------------------------------------------------------
// 3. Token Generator
// --------------------------------------------------------
function generateTokens(channel: string, uid: string, role: "publisher" | "subscriber") {
  const expirationSeconds = 3600;
  const current = Math.floor(Date.now() / 1000);
  const expireAt = current + expirationSeconds;

  const rtcRole = role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const rtmRole = RtmRole.Rtm_User;

  const rtcToken = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERT,
    channel,
    Number(uid),
    rtcRole,
    expireAt,
  );

  const rtmToken = RtmTokenBuilder.buildToken(
    APP_ID,
    APP_CERT,
    `rtm_${uid}`,
    rtmRole,
    expireAt,
  );

  return {
    rtcToken,
    rtmToken,
    uid,
    rtmUid: `rtm_${uid}`,
    ttl: expirationSeconds,
    expiresAt: new Date(expireAt * 1000).toISOString(),
  };
}

// --------------------------------------------------------
// 4. Main Handler
// --------------------------------------------------------
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body = await req.json();

    const rawChannel = body.channel || "";
    const role = body.role || "publisher";
    const uid = body.uid || Math.floor(Math.random() * 9_000_000 + 1_000_000).toString();

    // ----------------------------------------------------
    // Normalize channel BEFORE token generation
    // ----------------------------------------------------
    const channel = normalizeChannel(rawChannel);

    // ----------------------------------------------------
    // DEBUG LOGGING (appears in Supabase Edge Logs)
    // ----------------------------------------------------
    console.log("[AGORA TOKEN] Incoming request:", {
      rawChannel,
      normalizedChannel: channel,
      role,
      uid,
    });

    // Missing App ID / Cert error
    if (!APP_ID || !APP_CERT) {
      console.error("[AGORA TOKEN ERROR] Missing Agora credentials.");
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing AGORA_APP_ID or AGORA_APP_CERTIFICATE",
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Generate tokens
    const tokenPayload = generateTokens(channel, uid, role);

    console.log("[AGORA TOKEN] Tokens generated OK for:", {
      normalizedChannel: channel,
      uid: tokenPayload.uid,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        appId: APP_ID,
        ...tokenPayload,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error("[AGORA TOKEN] ERROR:", err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
