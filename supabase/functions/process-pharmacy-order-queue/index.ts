import { createAdminClient } from '../_shared/supabaseAdmin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();

    console.log('[process-pharmacy-order-queue] Starting queue processing...');

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
        console.log('[process-pharmacy-order-queue] No pending jobs found');
        return new Response(
          JSON.stringify({ message: 'No pending jobs' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      throw fetchError;
    }

    console.log(`[process-pharmacy-order-queue] Processing job ${job.id} for order_line ${job.order_line_id}`);

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

    console.log(`[process-pharmacy-order-queue] Send result:`, sendResult);

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

      console.log(`[process-pharmacy-order-queue] Job ${job.id} completed successfully`);

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

      console.log(`[process-pharmacy-order-queue] Job ${job.id} failed (attempt ${newAttemptCount}/${job.max_attempts}): ${errorMessage}`);

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
    console.error('[process-pharmacy-order-queue] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});