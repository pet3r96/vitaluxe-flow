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
    edgeLogger.info('[backfill-subscription-commissions] Starting commission backfill');
    const startTime = performance.now();

    const adminClient = createAdminClient();

    // Get all paid subscription payments that don't have a commission record
    const { data: payments, error: paymentsError } = await adminClient
      .from('subscription_payments')
      .select(`
        id,
        subscription_id,
        amount,
        payment_status,
        practice_subscriptions (
          assigned_rep_id,
          monthly_price,
          rep_commission_percentage
        )
      `)
      .eq('payment_status', 'paid')
      .not('practice_subscriptions.assigned_rep_id', 'is', null);

    if (paymentsError) {
      edgeLogger.error('[backfill-subscription-commissions] Error fetching payments', { error: paymentsError });
      throw paymentsError;
    }

    edgeLogger.info('[backfill-subscription-commissions] Found payments', { count: payments?.length || 0 });

    let createdCount = 0;
    let skippedCount = 0;

    for (const payment of payments || []) {
      const subscription = payment.practice_subscriptions as any;
      
      if (!subscription?.assigned_rep_id) {
        skippedCount++;
        continue;
      }

      // Skip if no commission percentage set
      if (!subscription.rep_commission_percentage || subscription.rep_commission_percentage <= 0) {
        skippedCount++;
        continue;
      }

      // Check if commission already exists
      const { data: existing } = await adminClient
        .from('rep_subscription_commissions')
        .select('id')
        .eq('payment_id', payment.id)
        .single();

      if (existing) {
        skippedCount++;
        continue;
      }

      // Calculate commission
      const commissionAmount = (subscription.monthly_price * subscription.rep_commission_percentage / 100);

      // Create commission record
      const { error: insertError } = await adminClient
        .from('rep_subscription_commissions')
        .insert({
          rep_id: subscription.assigned_rep_id,
          subscription_id: payment.subscription_id,
          payment_id: payment.id,
          commission_amount: commissionAmount,
          commission_percentage: subscription.rep_commission_percentage,
          payment_status: 'pending'
        });

      if (insertError) {
        edgeLogger.error('[backfill-subscription-commissions] Error creating commission', { 
          error: insertError, 
          payment_id: payment.id 
        });
      } else {
        createdCount++;
      }
    }

    const duration = performance.now() - startTime;
    edgeLogger.info('[backfill-subscription-commissions] Completed successfully', {
      durationMs: duration.toFixed(2),
      createdCount,
      skippedCount
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription commissions backfilled successfully',
        duration: `${duration.toFixed(2)}ms`,
        createdCount,
        skippedCount,
        totalProcessed: (payments?.length || 0)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    edgeLogger.error('[backfill-subscription-commissions] Fatal error', { error });
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
