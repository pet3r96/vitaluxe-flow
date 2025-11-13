// 🔄 Lovable Cloud Deploy Trigger (Agora Health Check - 2025-11-11)
// ✅ Verifies Supabase auth and Agora credentials (AGORA_APP_ID / AGORA_APP_CERTIFICATE)
// ✅ Supports ?ping endpoint for quick, unauthenticated deployment checks

import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 🔹 Quick ping mode (unauthenticated)
    const url = new URL(req.url);
    if (url.searchParams.has("ping") || url.pathname.endsWith("/ping")) {
      return new Response(
        JSON.stringify({
          deployed: true,
          status: "ok",
          message: "Agora healthcheck live",
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 🔹 Authenticated mode (requires Supabase Bearer token)
    const supabase = createAdminClient();
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[agora-healthcheck] Running authenticated health check...");

    // 🔹 Validate environment variables
    const rawAppId = Deno.env.get("AGORA_APP_ID");
    const rawAppCert = Deno.env.get("AGORA_APP_CERTIFICATE");

    const appId = rawAppId?.trim();
    const appCertificate = rawAppCert?.trim();

    if (!appId || !appCertificate) {
      console.error("[agora-healthcheck] ❌ Missing Agora credentials");
      return new Response(
        JSON.stringify({
          healthy: false,
          error: "Missing Agora credentials",
          details: {
            hasAppId: !!appId,
            hasCertificate: !!appCertificate,
            envKeysPresent: rawAppId !== undefined && rawAppCert !== undefined,
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 🔹 Validate formats
    const appIdValid = /^[a-f0-9]{32}$/i.test(appId);
    const certValid = /^[a-f0-9]{32}$/i.test(appCertificate);

    if (!appIdValid || !certValid) {
      console.error("[agora-healthcheck] ❌ Invalid credential format");
      return new Response(
        JSON.stringify({
          healthy: false,
          error: "Invalid credential format",
          details: {
            appIdLength: appId.length,
            certificateLength: appCertificate.length,
            appIdValid,
            certValid,
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[agora-healthcheck] ✅ Health check passed");

    // 🔹 Success response
    return new Response(
      JSON.stringify({
        healthy: true,
        message: "Agora environment valid",
        validation: {
          appIdLength: appId.length,
          certificateLength: appCertificate.length,
          formatsValid: true,
        },
        samples: {
          appIdSample: `${appId.substring(0, 6)}...${appId.substring(26)}`,
          certificateSample: `${appCertificate.substring(0, 6)}...${appCertificate.substring(26)}`,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[agora-healthcheck] Error:", error);
    return new Response(
      JSON.stringify({
        healthy: false,
        error: error?.message ?? "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
