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

    // Step 1: Fetch all paid orders with practice linkage
    edgeLogger.info('[admin-recompute-profits] Fetching paid orders');
    const { data: orders, error: ordersError } = await adminClient
      .from('orders')
      .select(`
        id,
        total_amount,
        payment_status,
        status,
        doctor_id,
        practice_id,
        profiles!orders_practice_id_fkey (
          linked_topline_id
        )
      `)
      .eq('payment_status', 'paid')
      .in('status', ['pending', 'processing', 'shipped', 'delivered', 'completed']);

    if (ordersError) {
      edgeLogger.error('[admin-recompute-profits] Error fetching orders', { error: ordersError });
      throw ordersError;
    }

    edgeLogger.info('[admin-recompute-profits] Orders fetched', { count: orders?.length || 0 });

    const profitRecords = [];
    let processedCount = 0;
    let errorCount = 0;

    // Step 2: Process each order
    for (const order of orders || []) {
      try {
        // Get topline rep from practice linkage (profiles is array due to TS types)
        const toplineUserId = order.profiles?.[0]?.linked_topline_id;
        
        if (!toplineUserId) {
          edgeLogger.warn('[admin-recompute-profits] No topline linkage for order', { orderId: order.id });
          errorCount++;
          continue;
        }

        const { data: toplineRep, error: toplineError } = await adminClient
          .from('reps')
          .select('id')
          .eq('user_id', toplineUserId)
          .eq('role', 'topline')
          .maybeSingle();

        if (toplineError) {
          edgeLogger.error('[admin-recompute-profits] Error fetching topline rep', { 
            orderId: order.id, 
            error: toplineError 
          });
          errorCount++;
          continue;
        }

        if (!toplineRep) {
          edgeLogger.warn('[admin-recompute-profits] No topline rep found', { 
            orderId: order.id, 
            toplineUserId 
          });
          errorCount++;
          continue;
        }

        // Get downline rep if exists
        let downlineRepId = null;
        const { data: downlineRep } = await adminClient
          .from('reps')
          .select('id')
          .eq('assigned_topline_id', toplineRep.id)
          .eq('role', 'downline')
          .maybeSingle();

        downlineRepId = downlineRep?.id || null;

        // Calculate profits from order lines (non-RX products only)
        const { data: orderLines, error: linesError } = await adminClient
          .from('order_lines')
          .select(`
            quantity,
            products!order_lines_product_id_fkey (
              base_price,
              topline_price,
              downline_price,
              requires_prescription
            )
          `)
          .eq('order_id', order.id);

        if (linesError) {
          edgeLogger.error('[admin-recompute-profits] Error fetching order lines', { 
            orderId: order.id, 
            error: linesError 
          });
          errorCount++;
          continue;
        }

        let toplineProfit = 0;
        let downlineProfit = 0;

        for (const line of orderLines || []) {
          const product = line.products?.[0];
          if (!product?.requires_prescription) {
            // Topline profit
            if (product.topline_price && product.base_price) {
              toplineProfit += (product.topline_price - product.base_price) * (line.quantity || 1);
            }
            // Downline profit (only if downline exists)
            if (product.downline_price && product.base_price && downlineRepId) {
              downlineProfit += (product.downline_price - product.base_price) * (line.quantity || 1);
            }
          }
        }

        profitRecords.push({
          order_id: order.id,
          order_total: order.total_amount,
          topline_id: toplineRep.id,
          topline_profit: toplineProfit,
          downline_id: downlineRepId,
          downline_profit: downlineProfit,
          payment_status: order.payment_status
        });

        processedCount++;
        
        if (processedCount % 10 === 0) {
          edgeLogger.info('[admin-recompute-profits] Progress', { 
            processed: processedCount, 
            errors: errorCount 
          });
        }

      } catch (orderError) {
        edgeLogger.error('[admin-recompute-profits] Error processing order', { 
          orderId: order.id, 
          error: orderError instanceof Error ? orderError.message : String(orderError)
        });
        errorCount++;
      }
    }

    edgeLogger.info('[admin-recompute-profits] Calculations complete', { 
      processedCount, 
      errorCount,
      recordsToUpsert: profitRecords.length
    });

    // Step 3: Upsert using REST API (has write permissions!)
    if (profitRecords.length > 0) {
      edgeLogger.info('[admin-recompute-profits] Upserting profit records');
      
      const { error: upsertError } = await adminClient
        .from('order_profits')
        .upsert(profitRecords, { 
          onConflict: 'order_id',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        edgeLogger.error('[admin-recompute-profits] Upsert error', { 
          error: upsertError,
          recordCount: profitRecords.length
        });
        throw upsertError;
      }

      edgeLogger.info('[admin-recompute-profits] Upsert successful', { 
        recordCount: profitRecords.length 
      });

      // Auto-refresh rep productivity view
      edgeLogger.info('[admin-recompute-profits] Refreshing rep productivity view');
      const { error: refreshError } = await adminClient.rpc('refresh_rep_productivity_summary');
      if (refreshError) {
        edgeLogger.warn('[admin-recompute-profits] Failed to refresh rep productivity', { error: refreshError });
      } else {
        edgeLogger.info('[admin-recompute-profits] Rep productivity view refreshed successfully');
      }
    }

    const duration = performance.now() - startTime;
    edgeLogger.info('[admin-recompute-profits] Completed successfully', {
      durationMs: duration.toFixed(2),
      totalOrders: orders?.length || 0,
      processedOrders: processedCount,
      errorCount,
      profitRecordsCreated: profitRecords.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order profits recomputed successfully',
        duration: `${duration.toFixed(2)}ms`,
        stats: {
          totalOrders: orders?.length || 0,
          processedOrders: processedCount,
          errorCount,
          profitRecordsCreated: profitRecords.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : { error: JSON.stringify(error) };
    
    edgeLogger.error('[admin-recompute-profits] Fatal error', errorDetails);
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    
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
