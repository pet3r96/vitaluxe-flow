import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiToken = Deno.env.get("BAREMEDS_API_TOKEN");
    let apiUrl = Deno.env.get("BAREMEDS_API_URL") || "https://rxorders.baremeds.com";
    const siteId = Deno.env.get("BAREMEDS_SITE_ID") || "98923";

    // Ensure API URL has protocol
    if (!apiUrl.startsWith("http://") && !apiUrl.startsWith("https://")) {
      apiUrl = `https://${apiUrl}`;
    }

    if (!apiToken) {
      throw new Error("BAREMEDS_API_TOKEN not configured");
    }

    console.log("🔐 Testing BareMeds authentication...");
    console.log("API URL:", apiUrl);
    console.log("Site ID:", siteId);
    console.log("Token length:", apiToken.length);
    console.log("Token prefix:", apiToken.substring(0, 10) + "...");

    // Test /api/auth/me endpoint
    const meResponse = await fetch(`${apiUrl}/api/auth/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("BAREMEDS_API_TOKEN")}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    });

    const meData = await meResponse.text();
    
    console.log("📊 /api/auth/me Response:", {
      status: meResponse.status,
      statusText: meResponse.statusText,
      headers: Object.fromEntries(meResponse.headers.entries()),
      body: meData,
    });

    if (!meResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          endpoint: "/api/auth/me",
          status: meResponse.status,
          error: meData,
          token_info: {
            length: apiToken.length,
            prefix: apiToken.substring(0, 10),
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse successful response
    let userData;
    try {
      userData = JSON.parse(meData);
    } catch {
      userData = meData;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Token is valid",
        user: userData,
        site_id: siteId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("❌ Test error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
