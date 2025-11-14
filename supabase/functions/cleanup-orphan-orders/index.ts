import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cleanup Orphan Orders Edge Function
 * 
 * Identifies and removes orders that have no order_lines, which represent
 * incomplete order creation failures. This prevents "N/A" entries in the UI.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[cleanup-orphan-orders] Starting cleanup");

  try {
    const supabaseAdmin = createAdminClient();

    // Find orders without any order_lines
    const { data: ordersWithLines } = await supabaseAdmin
      .from("order_lines")
      .select("order_id")
      .neq("order_id", null);

    const orderIdsWithLines = new Set((ordersWithLines || []).map(ol => ol.order_id));

    // Get all orders
    const { data: allOrders } = await supabaseAdmin
      .from("orders")
      .select("id, created_at, total_amount, payment_status");

    if (!allOrders || allOrders.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No orders found",
          orphansDeleted: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find orphan orders (orders without order_lines)
    const orphanOrders = allOrders.filter(order => !orderIdsWithLines.has(order.id));

    console.log("[cleanup-orphan-orders] Found orphan orders:", {
      total: allOrders.length,
      withLines: orderIdsWithLines.size,
      orphans: orphanOrders.length
    });

    if (orphanOrders.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No orphan orders found",
          totalOrders: allOrders.length,
          orphansDeleted: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete orphan orders
    const orphanIds = orphanOrders.map(o => o.id);
    const { error: deleteError } = await supabaseAdmin
      .from("orders")
      .delete()
      .in("id", orphanIds);

    if (deleteError) {
      console.error("[cleanup-orphan-orders] Delete error:", deleteError);
      throw deleteError;
    }

    console.log("[cleanup-orphan-orders] Successfully deleted orphan orders:", orphanIds.length);

    return new Response(
      JSON.stringify({ 
        message: `Cleaned up ${orphanIds.length} orphan orders`,
        totalOrders: allOrders.length,
        orphansDeleted: orphanIds.length,
        orphanDetails: orphanOrders.map(o => ({
          id: o.id,
          created_at: o.created_at,
          total_amount: o.total_amount,
          payment_status: o.payment_status
        }))
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[cleanup-orphan-orders] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Cleanup failed",
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
