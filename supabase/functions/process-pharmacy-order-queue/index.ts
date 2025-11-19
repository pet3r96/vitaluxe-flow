import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify cron secret for security
    const cronSecret = Deno.env.get('CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');
    
    if (!cronSecret || requestSecret !== cronSecret) {
      edgeLogger.error('[process-pharmacy-order-queue] Unauthorized attempt', { hasSecret: !!requestSecret });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient();

    edgeLogger.info('[process-pharmacy-order-queue] Starting queue processing');

    // Dequeue oldest pending job
    const { data: job, error: fetchError } = await supabase
      .from('pharmacy_order_jobs')
      .select(`
        *,
        order:orders!inner(*),
        order_line:order_lines!inner(*),
        pharmacy:pharmacies!inner(name, contact_email)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        edgeLogger.info('[process-pharmacy-order-queue] No pending jobs found');
        return new Response(
          JSON.stringify({ message: 'No pending jobs' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      throw fetchError;
    }

    edgeLogger.info('[process-pharmacy-order-queue] Processing job', { jobId: job.id, orderLineId: job.order_line_id });

    // Mark as processing
    await supabase
      .from('pharmacy_order_jobs')
      .update({ 
        status: 'processing', 
        last_attempt_at: new Date().toISOString() 
      })
      .eq('id', job.id);

    // Call send-pharmacy-order function
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-pharmacy-order', {
      body: {
        order_id: job.order_id,
        pharmacy_email: job.pharmacy.contact_email,
        pharmacy_name: job.pharmacy.name,
        payment_status: job.order.payment_status,
      }
    });

    edgeLogger.info('[process-pharmacy-order-queue] Send result', { sendResult });

    // Update job based on result
    if (!sendError && sendResult?.sent) {
      // Mark completed
      await supabase
        .from('pharmacy_order_jobs')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString(),
          baremeds_response: sendResult.response || null
        })
        .eq('id', job.id);

      edgeLogger.info('[process-pharmacy-order-queue] Job completed successfully', { jobId: job.id });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Order sent to pharmacy',
          job_id: job.id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } else {
      // Increment attempts, mark as failed or pending for retry
      const newAttemptCount = (job.attempt_count || 0) + 1;
      const newStatus = newAttemptCount >= (job.max_attempts || 3) 
        ? 'max_retries_exceeded' 
        : 'pending';
      
      const errorMessage = sendError?.message || sendResult?.error || 'Order not sent';

      await supabase
        .from('pharmacy_order_jobs')
        .update({ 
          status: newStatus,
          attempt_count: newAttemptCount,
          last_error: errorMessage
        })
        .eq('id', job.id);

      edgeLogger.warn('[process-pharmacy-order-queue] Job failed', { jobId: job.id, attempt: newAttemptCount, maxAttempts: job.max_attempts, error: errorMessage });

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Job failed (attempt ${newAttemptCount}/${job.max_attempts})`,
          job_id: job.id,
          error: errorMessage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

  } catch (error) {
    edgeLogger.error('[process-pharmacy-order-queue] Error', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});