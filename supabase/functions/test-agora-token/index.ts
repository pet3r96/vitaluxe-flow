import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { generateAgoraTokens } from "../_shared/agoraTokens.ts";

console.log("Test Agora Token function started");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
