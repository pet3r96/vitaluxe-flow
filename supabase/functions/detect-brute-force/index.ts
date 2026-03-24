import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { validateDetectBruteForceRequest } from "../_shared/requestValidators.ts";
import { edgeLogger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse JSON with error handling
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      edgeLogger.error('Invalid JSON in request body', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = validateDetectBruteForceRequest(requestData);
    if (!validation.valid) {
      edgeLogger.warn('Validation failed', { errors: validation.errors });
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data', 
          details: validation.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createAdminClient();

    const { email, attempt_count, ip_address } = requestData;

    // Sanitize IP address passed from track-failed-login
    let ip = ip_address ?? null;
    if (ip && typeof ip === "string") {
      const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
      if (!ipv4Regex.test(ip)) {
        // Invalid format - store as null
        ip = null;
      }
    } else {
      ip = null;
    }

    edgeLogger.info('Detecting brute force', { attempt_count, ip: ip || 'unknown' });

    // Log critical security event
    await supabaseClient.from("security_events").insert({
      event_type: "brute_force",
      severity: "critical",
      user_email: email,
      ip_address: ip,
      details: {
        email,
        ip_address: ip,
        attempt_count,
        timestamp: new Date().toISOString(),
      },
    });

    // Trigger alert
    await supabaseClient.functions.invoke("trigger-alert", {
      body: {
        event_type: "brute_force",
        severity: "critical",
        message: `Brute force attack detected: ${attempt_count} failed login attempts for ${email} from ${ip || 'unknown'}`,
        details: { email, ip_address: ip, attempt_count },
      },
    });

    // Lock account if user exists (direct email lookup instead of paginated listUsers)
    const { data: userLookup } = await supabaseClient.auth.admin.getUserByEmail(email);
    const user = userLookup?.user || null;
    
    if (user) {
      await supabaseClient.from("account_lockouts").insert({
        user_id: user.id,
        user_email: email,
        ip_address: ip,
        lockout_reason: "brute_force_detected",
        locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      });
      edgeLogger.warn('Account locked', { locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    edgeLogger.error("Error detecting brute force", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
