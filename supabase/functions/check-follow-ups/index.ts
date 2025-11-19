import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

Deno.serve(async (req) => {
  try {
    // Verify cron secret for security
    const cronSecret = Deno.env.get('CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');
    
    if (!cronSecret || requestSecret !== cronSecret) {
      edgeLogger.error('Unauthorized follow-up check attempt', { hasSecret: !!requestSecret });
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createAdminClient();

    // Call the database function to check and create notifications
    const { error } = await supabase.rpc('notify_due_follow_ups');

    if (error) {
      edgeLogger.error('Error calling notify_due_follow_ups', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('Successfully checked follow-ups and created notifications');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Follow-up notifications processed successfully',
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    edgeLogger.error('Unexpected error', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
