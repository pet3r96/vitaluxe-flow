import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Background job to refresh rep_productivity_view
 * Scheduled to run every 15 minutes via Supabase Cron
 * This prevents blocking user-facing queries
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = performance.now();
    edgeLogger.info('[refresh-rep-productivity] Starting scheduled refresh');

    const supabase = createAdminClient();

    const { error } = await supabase.rpc('refresh_rep_productivity_summary');

    if (error) {
      edgeLogger.error('[refresh-rep-productivity] Error', error);
      throw error;
    }

    const duration = performance.now() - startTime;
    edgeLogger.info('[refresh-rep-productivity] Completed', { durationMs: duration.toFixed(2) });

    return new Response(
      JSON.stringify({ success: true, duration }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    edgeLogger.error('[refresh-rep-productivity] Error', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
