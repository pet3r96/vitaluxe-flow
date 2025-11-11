import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const frontendAppId = body.appId;
    const backendAppId = Deno.env.get("AGORA_APP_ID");
    const cert = Deno.env.get("AGORA_APP_CERTIFICATE");

    const result = {
      frontendAppId,
      backendAppId,
      certificateHash: cert?.substring(0, 8),
      match: frontendAppId === backendAppId,
      timestamp: new Date().toISOString()
    };

    if (!result.match) {
      console.warn("⚠️ Agora App ID mismatch detected!");
      console.warn(`   Frontend: ${frontendAppId}`);
      console.warn(`   Backend: ${backendAppId}`);
    } else {
      console.log("✅ Agora App ID verification passed");
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error verifying Agora config:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
