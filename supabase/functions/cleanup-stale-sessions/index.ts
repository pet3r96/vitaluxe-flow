import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Cleanup Stale Sessions Edge Function
 * 
 * Scheduled to run every 15 minutes via cron job.
 * Removes sessions that have been inactive for >30 minutes.
 * This enforces idle timeout even if client doesn't cooperate.
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const startTime = new Date().toISOString();
    console.log(`[${startTime}] Starting stale session cleanup...`);

    // Delete sessions inactive for >30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    console.log(`Checking for sessions last active before: ${thirtyMinutesAgo}`);
    
    const { data: staleSessions, error: fetchError } = await supabase
      .from('active_sessions')
      .select('id, user_id, last_activity')
      .lt('last_activity', thirtyMinutesAgo);

    if (fetchError) {
      console.error('Error fetching stale sessions:', fetchError);
      throw fetchError;
    }

    const staleCount = staleSessions?.length || 0;
    console.log(`Found ${staleCount} stale sessions to clean up`);

    if (staleCount > 0) {
      // Log forced logouts to audit_logs
      for (const session of staleSessions || []) {
        await supabase.from('audit_logs').insert({
          user_id: session.user_id,
          action_type: 'force_logout',
          entity_type: 'active_sessions',
          entity_id: session.id,
          details: {
            reason: 'idle_timeout',
            last_activity: session.last_activity,
            cleanup_time: new Date().toISOString(),
          },
        });
      }

      // Delete stale sessions
      const { error: deleteError } = await supabase
        .from('active_sessions')
        .delete()
        .lt('last_activity', thirtyMinutesAgo);

      if (deleteError) {
        console.error('Error deleting stale sessions:', deleteError);
        throw deleteError;
      }

      console.log(`✅ Successfully cleaned up ${staleCount} stale sessions and created audit log entries`);
    }

    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Cleanup complete. Next run in 15 minutes.`);

    return new Response(
      JSON.stringify({
        success: true,
        cleaned: staleCount,
        timestamp: endTime,
        next_run: 'in 15 minutes (cron: */15 * * * *)',
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
