import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueueItem {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  action_url?: string;
  entity_type?: string;
  entity_id?: string;
  retry_count: number;
  max_retries: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();
    
    edgeLogger.info('[QueueProcessor] Starting queue processing');
    
    // Fetch pending notifications (batch of 50)
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      edgeLogger.error('[QueueProcessor] Error fetching queue', fetchError);
      throw fetchError;
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      edgeLogger.info('[QueueProcessor] No pending notifications in queue');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info(`[QueueProcessor] Processing ${pendingNotifications.length} notifications`);

    const results = {
      total: pendingNotifications.length,
      sent: 0,
      failed: 0,
      maxRetriesReached: 0
    };

    // Process each notification
    for (const notification of pendingNotifications as QueueItem[]) {
      try {
        edgeLogger.info(`[QueueProcessor] Processing notification ${notification.id}`);
        
        // Mark as processing
        await supabase
          .from('notification_queue')
          .update({ status: 'processing' })
          .eq('id', notification.id);

        // Call handleNotifications
        const { data: handleResult, error: handleError } = await supabase.functions.invoke('handleNotifications', {
          body: {
            user_id: notification.user_id,
            notification_type: notification.notification_type,
            title: notification.title,
            message: notification.message,
            metadata: notification.metadata || {},
            action_url: notification.action_url,
            entity_type: notification.entity_type,
            entity_id: notification.entity_id
          }
        });

        if (handleError) {
          throw new Error(handleError.message || 'Unknown error from handleNotifications');
        }

        if (!handleResult?.success) {
          throw new Error(handleResult?.error || 'handleNotifications returned success=false');
        }

        // Mark as sent
        await supabase
          .from('notification_queue')
          .update({ 
            status: 'sent',
            processed_at: new Date().toISOString()
          })
          .eq('id', notification.id);

        results.sent++;
        edgeLogger.info(`[QueueProcessor] Notification ${notification.id} sent successfully`);

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        edgeLogger.error(`[QueueProcessor] Notification ${notification.id} failed`, error);

        const newRetryCount = notification.retry_count + 1;

        if (newRetryCount >= notification.max_retries) {
          // Max retries reached - mark as failed
          await supabase
            .from('notification_queue')
            .update({ 
              status: 'failed',
              retry_count: newRetryCount,
              error_message: errorMessage,
              processed_at: new Date().toISOString()
            })
            .eq('id', notification.id);

          results.maxRetriesReached++;
          edgeLogger.error(`[QueueProcessor] Notification ${notification.id} failed permanently after ${newRetryCount} attempts`);
        } else {
          // Retry later - reset to pending
          await supabase
            .from('notification_queue')
            .update({ 
              status: 'pending',
              retry_count: newRetryCount,
              error_message: errorMessage
            })
            .eq('id', notification.id);

          results.failed++;
          edgeLogger.warn(`[QueueProcessor] Notification ${notification.id} will retry (attempt ${newRetryCount}/${notification.max_retries})`);
        }
      }
    }

    edgeLogger.info('[QueueProcessor] Queue processing complete', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    edgeLogger.error('[QueueProcessor] Fatal error processing queue', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
