// 🔄 Lovable Cloud Auto-Deploy Trigger (Agora token function patched 2025-11-11)
// ✅ Added validation + live health logging for faster debugging
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createAgoraTokens } from "../_shared/agoraTokenService.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    if (url.pathname.endsWith("/health")) {
      return new Response(JSON.stringify({ status: "ok", deployed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body?.channel) throw new Error("Missing channel field.");

    const { channel, uid, role = "publisher", ttl = 3600 } = body;
    console.log(`[agora-token] Request: ${channel} (uid=${uid}, role=${role}, ttl=${ttl})`);

    const tokens = await createAgoraTokens(channel, uid ?? crypto.randomUUID(), role, ttl);

    return new Response(JSON.stringify({ ok: true, ...tokens }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("[agora-token] Error:", err.message);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message ?? "Unknown error",
        hint: "Ensure AGORA_APP_ID and AGORA_APP_CERTIFICATE are configured in env",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
