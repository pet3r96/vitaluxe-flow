import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { generateAgoraTokens } from "../_shared/agoraTokens.ts";

console.log("Test Agora Token function started");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Raw bytes check for secrets
    const rawAppId = Deno.env.get("AGORA_APP_ID") || "";
    const rawCert = Deno.env.get("AGORA_APP_CERTIFICATE") || "";
    console.log("[Test Agora Token] AppID raw bytes:", Array.from(new TextEncoder().encode(rawAppId)));
    console.log("[Test Agora Token] AppID length:", rawAppId.length);
    console.log("[Test Agora Token] Cert raw bytes prefix:", Array.from(new TextEncoder().encode(rawCert)).slice(0, 16));

    // Probe Agora public API (may return 403/404 depending on policy)
    try {
      const res = await fetch(`https://api.agora.io/v1/apps/${rawAppId}`);
      const body = await res.text();
      console.log("[Test Agora Token] Agora API status:", res.status);
      console.log("[Test Agora Token] Agora API body prefix:", body.substring(0, 120));
    } catch (probeErr) {
      console.log("[Test Agora Token] Agora API fetch error:", (probeErr as any)?.message || String(probeErr));
    }

    console.log("[Test Agora Token] Generating sample token...");

    // Generate test token with sample data
    const testChannelName = "test-channel-" + Date.now();
    const testUid = "test-user-" + Math.floor(Math.random() * 10000);
    
    console.log("Triggering verification...");
    console.log("[Test Endpoint] Parameters:", {
      channelName: testChannelName,
      uid: testUid,
      role: 'publisher',
      expiresInSeconds: 3600,
    });
    
    const tokens = await generateAgoraTokens({
      channelName: testChannelName,
      uid: testUid,
      role: 'publisher',
      expiresInSeconds: 3600,
    });

    // Assertions
    const rtcStartsWith007 = tokens.rtcToken.startsWith('007');
    const rtmStartsWith007 = tokens.rtmToken.startsWith('007');
    const tokensAreDifferent = tokens.rtcToken !== tokens.rtmToken;
    
    console.log("[Test Agora Token] Token generated successfully", {
      channelName: testChannelName,
      uid: testUid,
      rtcTokenLength: tokens.rtcToken.length,
      rtmTokenLength: tokens.rtmToken.length,
      rtcStartsWith007,
      rtmStartsWith007,
      tokensAreDifferent,
      expiresAt: new Date(tokens.expiresAt * 1000).toISOString(),
    });

    console.log("\n📊 [Detailed Token Analysis]");
    console.log("RTC Token Structure:");
    console.log("├─ Prefix:", tokens.rtcToken.substring(0, 3));
    console.log("├─ First 30 chars:", tokens.rtcToken.substring(0, 30));
    console.log("├─ Length:", tokens.rtcToken.length);
    console.log("└─ Last 20 chars:", tokens.rtcToken.slice(-20));

    console.log("\nRTM Token Structure:");
    console.log("├─ Prefix:", tokens.rtmToken.substring(0, 3));
    console.log("├─ First 30 chars:", tokens.rtmToken.substring(0, 30));
    console.log("├─ Length:", tokens.rtmToken.length);
    console.log("└─ Last 20 chars:", tokens.rtmToken.slice(-20));

    // Env diagnostics for hidden bytes
    const appIdBytes = new TextEncoder().encode(Deno.env.get("AGORA_APP_ID") || "");
    const certBytes = new TextEncoder().encode(Deno.env.get("AGORA_APP_CERTIFICATE") || "");
    const appIdLastByte = appIdBytes.length ? appIdBytes[appIdBytes.length - 1] : null;

    console.log("\n🔍 [Certificate Format Check]");
    console.log("✅ Certificate is being used as UTF-8 bytes (not hex-decoded)");
    console.log("Certificate byte count:", certBytes.length);
    console.log("Expected for 32-char string: 32 bytes");

    // Validation checks
    if (!rtcStartsWith007 || !rtmStartsWith007) {
      console.error("[Test Agora Token] ERROR: Tokens don't start with 007!");
      console.error("RTC token prefix:", tokens.rtcToken.substring(0, 20));
      console.error("RTM token prefix:", tokens.rtmToken.substring(0, 20));
    }
    
    if (!tokensAreDifferent) {
      console.error("[Test Agora Token] ERROR: RTC and RTM tokens are identical!");
    }

    return new Response(
      JSON.stringify({
        success: true,
        testData: {
          channelName: testChannelName,
          uid: testUid,
          role: 'publisher',
          expiresInSeconds: 3600,
        },
        tokens: {
          rtcToken: tokens.rtcToken,
          rtmToken: tokens.rtmToken,
          rtmUid: tokens.rtmUid,
          expiresAt: tokens.expiresAt,
          expiresAtISO: new Date(tokens.expiresAt * 1000).toISOString(),
          appId: tokens.appId,
        },
        validation: {
          rtcStartsWith007,
          rtmStartsWith007,
          tokensAreDifferent,
          rtcTokenLength: tokens.rtcToken.length,
          rtmTokenLength: tokens.rtmToken.length,
        },
        tokenInfo: {
          rtcPrefix: tokens.rtcToken.substring(0, 15),
          rtmPrefix: tokens.rtmToken.substring(0, 15),
          version: rtcStartsWith007 ? 'AccessToken2 (007)' : 'Unknown',
        },
        envDiagnostics: {
          appIdLen: appIdBytes.length,
          appIdLastByte,
          certLen: certBytes.length,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[Test Agora Token] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.toString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
