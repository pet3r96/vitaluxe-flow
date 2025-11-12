// 🧹 TODO AGORA REFACTOR
import { serve } from "https://deno.land/std@0.170.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

    try {
      console.warn("🚫 [Agora Debug] Disabled pending refactor");
      return new Response(
        JSON.stringify({ error: "Agora debug endpoint temporarily disabled" }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      /* const { errorCode, message, appId, channel, uid } = await req.json();
    
    console.log("🧩 [Agora Debug] Error logged from frontend:");
    console.log(JSON.stringify({
      errorCode,
      message,
      appId: appId ? `${appId.substring(0, 8)}...` : null,
      channel,
      uid,
      timestamp: new Date().toISOString()
    }, null, 2));

    // Map known Agora error codes
    const knownErrors: Record<number, string> = {
      101: "Invalid App ID - The App ID is incorrect or does not exist",
      102: "Invalid Channel Name - Channel name format is incorrect",
      109: "Token Expired - The token has expired and needs to be regenerated",
      110: "Invalid Token Format or Signature - Token structure or signature is incorrect",
      111: "Token Revoked - The token has been revoked",
      17: "Request to Join Channel Failed - Cannot join the channel",
      18: "Leave Channel Failed - Error when leaving the channel",
      19: "No Authorization - User is not authorized to perform this action",
      20: "Request Too Frequently - Rate limit exceeded",
    };

    const readable = knownErrors[errorCode] || `Unknown Agora Error (Code: ${errorCode})`;

    console.log(`🔍 [Agora Debug] Interpreted: ${readable}`);

    // Additional diagnostic suggestions
    const suggestions: string[] = [];
    if (errorCode === 101) {
      suggestions.push("Verify AGORA_APP_ID in backend secrets matches frontend .env");
      suggestions.push("Check if App ID is correctly configured in Agora Console");
    } else if (errorCode === 109) {
      suggestions.push("Token has expired - implement token refresh logic");
      suggestions.push("Check server time synchronization");
    } else if (errorCode === 110) {
      suggestions.push("Verify AGORA_APP_CERTIFICATE is correctly set");
      suggestions.push("Check token generation logic in edge functions");
      suggestions.push("Ensure App ID and Certificate match in Agora Console");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        interpretedError: readable,
        suggestions,
        received: { 
          errorCode, 
          message, 
          appId: appId ? `${appId.substring(0, 8)}...` : null,
          channel, 
          uid 
        },
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
      );
      */
  } catch (err) {
    console.error("❌ [Agora Debug] Error processing debug request:", err);
    return new Response(
      JSON.stringify({ 
        error: err.message || "Failed to process debug request" 
      }), 
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});
