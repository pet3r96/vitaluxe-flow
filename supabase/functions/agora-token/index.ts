// supabase/functions/agora-token/index.ts
// --------------------------------------------------------
// VITALUXE — AGORA TOKEN SERVICE (FULL PATCHED VERSION)
// --------------------------------------------------------

import {
  serve,
} from "https://deno.land/std@0.177.0/http/server.ts";

import { createAgoraTokens } from "../_shared/agoraTokenService.ts";

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
// Token generation moved to shared service (agoraTokenService.ts)
// See createAgoraTokens(channel, uid, role, expireSeconds)

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

    // Generate tokens via shared service (Web Crypto compatible)
    const { rtcToken, rtmToken, expiresAt } = await createAgoraTokens(
      channel,
      String(uid),
      role,
      3600
    );

    console.log("[AGORA TOKEN] Tokens generated OK for:", {
      normalizedChannel: channel,
      uid: String(uid),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        appId: APP_ID,
        rtcToken,
        rtmToken,
        uid: String(uid),
        rtmUid: String(uid),
        ttl: 3600,
        expiresAt
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[AGORA TOKEN] ERROR:", errorMessage);

    return new Response(
      JSON.stringify({
        ok: false,
        error: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
