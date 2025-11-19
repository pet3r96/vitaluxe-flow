import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { validateTrackFailedLoginRequest } from "../_shared/requestValidators.ts";
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const startTime = Date.now();
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
    const validation = validateTrackFailedLoginRequest(requestData);
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

    const { email, user_agent } = requestData;

    // Extract IP from request headers (NOT from request body)
    const ipHeader = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
    const clientIp = (ipHeader.split(",")[0] || "").trim();
    
    // Validate IP format (IPv4/IPv6) - reject malformed input
    const ip = /^[0-9a-fA-F:.\s]+$/.test(clientIp) ? clientIp : null;
    
    if (!ip) {
      edgeLogger.warn('Invalid IP address format detected', { clientIp });
    }

    edgeLogger.info('Tracking failed login', { email, ip: ip || 'unknown' });

    // Log security event
    await supabaseClient.from("security_events").insert({
      event_type: "failed_login",
      severity: "medium",
      user_email: email,
      ip_address: ip,
      user_agent,
      details: { email, timestamp: new Date().toISOString() },
    });

    // PHASE 2: Audit logging for login_failed
    const { error: auditInsertError } = await supabaseClient.from("audit_logs").insert({
      user_email: email,
      action_type: "login_failed",
      entity_type: "auth_users",
      ip_address: ip,
      user_agent,
      details: {
        email,
        timestamp: new Date().toISOString()
      }
    });
    
    if (auditInsertError) {
      edgeLogger.error('Failed to log audit event', auditInsertError);
    }

    // Track failed attempts
    const { data: existing } = await supabaseClient
      .from("failed_login_attempts")
      .select("*")
      .eq("email", email)
      .eq("ip_address", ip)
      .gte("last_attempt_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .maybeSingle();

    if (existing) {
      const newCount = existing.attempt_count + 1;
      await supabaseClient
        .from("failed_login_attempts")
        .update({
          attempt_count: newCount,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      edgeLogger.info('Updated attempt count', { count: newCount, email });

      // Check for brute force (5+ attempts in 10 minutes)
      if (newCount >= 5) {
        edgeLogger.warn('Brute force detected, invoking detect-brute-force', { email });
        await supabaseClient.functions.invoke("detect-brute-force", {
          body: { email, ip_address: ip, attempt_count: newCount },
        });
      }
    } else {
      await supabaseClient.from("failed_login_attempts").insert({
        email,
        ip_address: ip,
        user_agent,
        attempt_count: 1,
      });
      edgeLogger.info('Created new failed login attempt record', { email });
    }

    // PHASE 2: Enhanced audit trail with login_failed event
    await supabaseClient.from('audit_logs').insert({
      action_type: 'login_failed',
      user_email: email,
      ip_address: ip || 'unknown',
      user_agent: user_agent,
      details: { 
        success: false,
        timestamp: new Date().toISOString()
      }
    });

    // PHASE 2: Structured logging
    edgeLogger.logOperation({
      user_id: undefined,
      ip_address: ip || 'unknown',
      operation: 'track_failed_login',
      success: true,
      duration_ms: Date.now() - startTime,
      metadata: { email }
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    edgeLogger.error("Error tracking failed login", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
