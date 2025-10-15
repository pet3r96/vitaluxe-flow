import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateDetectAnomaliesRequest } from "../_shared/requestValidators.ts";

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
      console.error('Invalid JSON in request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = validateDetectAnomaliesRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
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

    const { user_id, action_type, details } = requestData;

    console.log(`Detecting anomalies for user ${user_id}, action: ${action_type}`);

    // Example: Detect bulk downloads (>100 orders in 5 minutes)
    if (action_type === "bulk_download") {
      const { data: recentDownloads } = await supabaseClient
        .from("audit_logs")
        .select("*")
        .eq("user_id", user_id)
        .eq("action_type", "order_downloaded")
        .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

      if (recentDownloads && recentDownloads.length > 100) {
        console.log(`Anomaly detected: ${recentDownloads.length} downloads in 5 minutes`);
        
        await supabaseClient.from("security_events").insert({
          event_type: "anomaly",
          severity: "high",
          user_id,
          details: {
            anomaly_type: "bulk_download",
            download_count: recentDownloads.length,
            timestamp: new Date().toISOString(),
            ...details,
          },
        });

        await supabaseClient.functions.invoke("trigger-alert", {
          body: {
            event_type: "anomaly",
            severity: "high",
            message: `Anomaly detected: ${recentDownloads.length} orders downloaded in 5 minutes by user ${user_id}`,
            details: { user_id, download_count: recentDownloads.length },
          },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error detecting anomalies:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
