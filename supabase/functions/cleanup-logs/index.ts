import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const correlationId = edgeLogger.generateCorrelationId();
    edgeLogger.info("cleanup-logs started", { 
      correlationId,
      isSystemMaintenance: true 
    });

    const start = Date.now();
    const { data, error } = await client.rpc("archive_all_logs");

    if (error) {
      edgeLogger.error("cleanup-logs failed", error, { 
        correlationId,
        isSystemMaintenance: true 
      });
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const duration = Date.now() - start;

    edgeLogger.info("cleanup-logs completed", {
      correlationId,
      duration_ms: duration,
      summary: data,
      isSystemMaintenance: true
    });

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        summary: data,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    edgeLogger.error("cleanup-logs exception", error, { 
      isSystemMaintenance: true 
    });
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
