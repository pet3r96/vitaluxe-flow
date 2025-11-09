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
    
    const tokens = await generateAgoraTokens({
      channelName: testChannelName,
      uid: testUid,
      role: 'publisher',
      expiresInSeconds: 3600,
    });

    console.log("[Test Agora Token] Token generated successfully", {
      channelName: testChannelName,
      uid: testUid,
      tokenLength: tokens.rtcToken.length,
      expiresAt: new Date(tokens.expiresAt * 1000).toISOString(),
    });

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
        tokenInfo: {
          length: tokens.rtcToken.length,
          prefix: tokens.rtcToken.substring(0, 20),
          version: tokens.rtcToken.startsWith('007') ? 'AccessToken2 (007)' : 'Unknown',
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
