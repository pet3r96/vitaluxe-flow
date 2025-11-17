import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateTriggerAlertRequest } from "../_shared/requestValidators.ts";
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
    const validation = validateTriggerAlertRequest(requestData);
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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { event_type, severity, message, details } = requestData;

    edgeLogger.info('Triggering alert', { eventType: event_type, severity });

    // Find matching alert rules
    const { data: rules } = await supabaseClient
      .from("alert_rules")
      .select("*")
      .eq("event_type", event_type)
      .eq("enabled", true);

    if (!rules || rules.length === 0) {
      edgeLogger.info("No matching alert rules found");
      return new Response(
        JSON.stringify({ success: true, message: "No matching rules" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info('Found matching alert rules', { count: rules.length });

    // Create alert records
    for (const rule of rules) {
      const { data: alert } = await supabaseClient
        .from("alerts")
        .insert({
          rule_id: rule.id,
          event_type,
          severity,
          message,
          details,
        })
        .select()
        .single();

      edgeLogger.info('Alert created', { ruleName: rule.name, message });
      
      // Here you would integrate with notification services (email, Slack, etc.)
      // For now, we just log the alert
    }

    return new Response(JSON.stringify({ success: true, alerts_created: rules.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    edgeLogger.error("Error triggering alert", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
