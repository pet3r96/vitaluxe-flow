import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { buildRtcToken, buildRtmToken, verifyTokenSignature, Role } from "../_shared/agoraTokenBuilder.ts";

console.log("Test Agora Token function started");

// Token decoder and verifier
function decodeToken(token: string, appId: string, appCertificate: string) {
  try {
    if (!token.startsWith('007')) {
      return { error: 'Token does not start with 007' };
    }

    const base64Part = token.substring(3);
    const binaryString = atob(base64Part);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    if (bytes.length < 32) {
      return { error: 'Token too short' };
    }

    const signature = bytes.slice(0, 32);
    const message = bytes.slice(32);

    let offset = 0;
    const readUint32LE = () => {
      const v = message[offset] | (message[offset + 1] << 8) | (message[offset + 2] << 16) | (message[offset + 3] << 24);
      offset += 4;
      return v >>> 0;
    };
    const readUint16LE = () => {
      const v = message[offset] | (message[offset + 1] << 8);
      offset += 2;
      return v & 0xFFFF;
    };
    const readString = () => {
      const len = readUint16LE();
      const str = new TextDecoder().decode(message.slice(offset, offset + len));
      offset += len;
      return str;
    };

    const salt = readUint32LE();
    const ts = readUint32LE();
    const serviceCount = readUint16LE();

    const services: any[] = [];
    for (let i = 0; i < serviceCount; i++) {
      const serviceType = readUint16LE();
      // CRITICAL FIX: AccessToken2 does NOT have a serviceLen field after serviceType
      // Parse fields directly in sequence (no length wrapper)
      
      let serviceData: any = { type: serviceType };

      if (serviceType === 1) {
        // RTC: channelName + uid + privileges
        serviceData.channelName = readString();
        serviceData.uid = readString();
        const privCount = readUint16LE();
        serviceData.privileges = [];
        for (let j = 0; j < privCount; j++) {
          const key = readUint16LE();
          const expire = readUint32LE();
          serviceData.privileges.push({ key, expire, expireISO: new Date(expire * 1000).toISOString() });
        }
      } else if (serviceType === 2) {
        // RTM: uid + privileges (no channelName)
        serviceData.uid = readString();
        const privCount = readUint16LE();
        serviceData.privileges = [];
        for (let j = 0; j < privCount; j++) {
          const key = readUint16LE();
          const expire = readUint32LE();
          serviceData.privileges.push({ key, expire, expireISO: new Date(expire * 1000).toISOString() });
        }
      }

      services.push(serviceData);
      // No offset jump by length - we're already at the end of the service body
    }

    return {
      signature: Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join(''),
      message: {
        salt,
        timestamp: ts,
        timestampISO: new Date(ts * 1000).toISOString(),
        serviceCount,
        services,
      },
    };
  } catch (err: any) {
    return { error: err.message };
  }
}

// Note: verifyTokenSignature is now imported from _shared/agoraTokenBuilder.ts

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const deterministic = url.searchParams.get('deterministic') === 'true';
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
    console.log("[Test Agora Token] Deterministic mode:", deterministic);

    // Generate test token with sample data
    const testChannelName = deterministic ? "test-channel-fixed" : "test-channel-" + Date.now();
    const testUid = deterministic ? "test-user-1000" : "test-user-" + Math.floor(Math.random() * 10000);
    
    console.log("Triggering verification...");
    console.log("[Test Endpoint] Parameters:", {
      channelName: testChannelName,
      uid: testUid,
      role: 'publisher',
      expiresInSeconds: 3600,
    });
    
    // Generate tokens using Official Agora Port
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expire = currentTimestamp + 3600;
    
    console.log('🔧 [Test] Using official Agora AccessToken2 port');
    
    const rtcToken = await buildRtcToken(
      rawAppId,
      rawCert,
      testChannelName,
      testUid,
      Role.PUBLISHER,
      expire
    );
    
    const rtmToken = await buildRtmToken(
      rawAppId,
      rawCert,
      testUid,
      expire
    );
    
    const tokens = {
      rtcToken,
      rtmToken,
      rtmUid: testUid,
      expiresAt: expire,
      appId: rawAppId
    };

    // Verify token signatures using shared verifier
    const rtcSigValid = await verifyTokenSignature(tokens.rtcToken, rawAppId, rawCert);
    const rtmSigValid = await verifyTokenSignature(tokens.rtmToken, rawAppId, rawCert);

    console.log("\n🔐 [Signature Verification]");
    console.log("RTC signature valid:", rtcSigValid);
    console.log("RTM signature valid:", rtmSigValid);

    // Decode tokens
    const rtcDecoded = decodeToken(tokens.rtcToken, rawAppId, rawCert);
    const rtmDecoded = decodeToken(tokens.rtmToken, rawAppId, rawCert);

    console.log("\n📦 [RTC Token Structure]");
    console.log(JSON.stringify(rtcDecoded, null, 2));

    console.log("\n📦 [RTM Token Structure]");
    console.log(JSON.stringify(rtmDecoded, null, 2));

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
          deterministicMode: deterministic,
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
        signatureVerification: {
          rtcSignatureValid: rtcSigValid,
          rtmSignatureValid: rtmSigValid,
        },
        decodedTokens: {
          rtc: rtcDecoded,
          rtm: rtmDecoded,
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
