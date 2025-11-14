import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    console.log('[refresh-rep-productivity] Starting scheduled refresh...');
    const startTime = performance.now();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error } = await supabase.rpc('refresh_rep_productivity_summary');

    if (error) {
      console.error('[refresh-rep-productivity] ❌ Error:', error);
      throw error;
    }

    const duration = performance.now() - startTime;
    console.log(`[refresh-rep-productivity] ✅ Completed in ${duration.toFixed(2)}ms`);

    return new Response(
      JSON.stringify({ success: true, duration }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[refresh-rep-productivity] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
