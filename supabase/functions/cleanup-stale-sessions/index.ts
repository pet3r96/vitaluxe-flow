import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Cleanup Stale Sessions Edge Function - DEPRECATED
 * 
 * This function is no longer actively used. The system now uses a simple
 * 60-minute hard session timeout on the client side with no database tracking.
 * 
 * The active_sessions table is no longer written to by the new implementation.
 * This function is kept as a no-op for backwards compatibility and can be
 * removed in a future cleanup.
 * 
 * Previous behavior: Removed sessions inactive for >30 minutes
 * New behavior: Returns success immediately without doing anything
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[cleanup-stale-sessions] DEPRECATED - No-op function');
    
    const endTime = new Date().toISOString();
    
    return new Response(
      JSON.stringify({
        success: true,
        cleaned: 0,
        timestamp: endTime,
        message: 'DEPRECATED: Session cleanup now handled by client-side 60-minute hard timeout',
        next_run: 'Function is deprecated',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Cleanup failed:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
