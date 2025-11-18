import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    edgeLogger.info('[admin-recompute-profits] Starting profit recomputation');
    const startTime = performance.now();

    const adminClient = createAdminClient();

    // Call the database function to recompute all order profits
    const { data, error } = await adminClient.rpc('recompute_order_profits');

    if (error) {
      edgeLogger.error('[admin-recompute-profits] Recomputation error', { error });
      throw error;
    }

    const duration = performance.now() - startTime;
    edgeLogger.info('[admin-recompute-profits] Completed successfully', {
      durationMs: duration.toFixed(2),
      result: data
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order profits recomputed successfully',
        duration: `${duration.toFixed(2)}ms`,
        data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    edgeLogger.error('[admin-recompute-profits] Fatal error', { error });
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
