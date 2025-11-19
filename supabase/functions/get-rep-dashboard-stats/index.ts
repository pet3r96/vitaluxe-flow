import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { cacheFetch } from '../_shared/cache.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  try {
    const { repId, role } = await req.json();
    const supabase = createAdminClient();

    if (!repId || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing repId or role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('[get-rep-dashboard-stats] Fetching stats', { repId, role });

    // Use cache with 60-second TTL
    const stats = await cacheFetch(
      `rep_dashboard:${repId}:${role}`,
      async () => {
        const statsData = {
          practiceCount: 0,
          orderCount: 0,
          downlineCount: 0,
          profitStats: null as any
        };

        // Get rep's user_id
        const { data: repData, error: repError } = await supabase
          .from('reps')
          .select('user_id')
          .eq('id', repId)
          .single();

        if (repError || !repData) {
          edgeLogger.error('[get-rep-dashboard-stats] Rep not found', repError);
          return statsData;
        }

        const repUserId = repData.user_id;

        // Calculate practice count and orders
        if (role === 'topline') {
          // Topline: count practices linked to this rep
          const { data: practices } = await supabase
            .from('profiles')
            .select('id')
            .eq('linked_topline_id', repUserId)
            .eq('active', true);
          statsData.practiceCount = practices?.length || 0;

          // Also count downlines
          const { data: downlines } = await supabase
            .from('reps')
            .select('id')
            .eq('assigned_topline_id', repId)
            .eq('role', 'downline');
          statsData.downlineCount = downlines?.length || 0;

          // Count orders from order_profits where topline is assigned
          const { data: toplineOrders } = await supabase
            .from('order_profits')
            .select('order_id')
            .eq('topline_id', repId);
          statsData.orderCount = toplineOrders?.length || 0;

          // Calculate profit stats
          const { data: profitData } = await supabase
            .from('order_profits')
            .select('order_total, topline_profit, payment_status')
            .eq('topline_id', repId);

          if (profitData && profitData.length > 0) {
            const totalRevenue = profitData.reduce((sum, p) => sum + (p.order_total || 0), 0);
            const totalProfit = profitData.reduce((sum, p) => sum + (p.topline_profit || 0), 0);
            const pendingProfit = profitData
              .filter(p => p.payment_status === 'pending' || p.payment_status === 'processing')
              .reduce((sum, p) => sum + (p.topline_profit || 0), 0);
            const orderCount = profitData.length;

            statsData.profitStats = {
              totalRevenue,
              totalProfit,
              pendingProfit,
              averageOrderValue: orderCount > 0 ? totalRevenue / orderCount : 0
            };
          }
        } else if (role === 'downline') {
          // Downline: count practices assigned to this downline's topline
          const { data: downlineRep } = await supabase
            .from('reps')
            .select('assigned_topline_id, reps!reps_assigned_topline_id_fkey(user_id)')
            .eq('id', repId)
            .single();

          if (downlineRep?.reps) {
            const toplineUserId = (downlineRep.reps as any).user_id;
            const { data: practices } = await supabase
              .from('profiles')
              .select('id')
              .eq('linked_topline_id', toplineUserId)
              .eq('active', true);
            statsData.practiceCount = practices?.length || 0;

          // Count orders from order_profits where downline is assigned
          const { data: downlineOrders } = await supabase
            .from('order_profits')
            .select('order_id')
            .eq('downline_id', repId);
          statsData.orderCount = downlineOrders?.length || 0;
          }
          statsData.downlineCount = 0; // Downlines don't have downlines

          // Calculate profit stats for downline
          const { data: profitData } = await supabase
            .from('order_profits')
            .select('order_total, downline_profit, payment_status')
            .eq('downline_id', repId);

          if (profitData && profitData.length > 0) {
            const totalRevenue = profitData.reduce((sum, p) => sum + (p.order_total || 0), 0);
            const totalProfit = profitData.reduce((sum, p) => sum + (p.downline_profit || 0), 0);
            const pendingProfit = profitData
              .filter(p => p.payment_status === 'pending' || p.payment_status === 'processing')
              .reduce((sum, p) => sum + (p.downline_profit || 0), 0);
            const orderCount = profitData.length;

            statsData.profitStats = {
              totalRevenue,
              totalProfit,
              pendingProfit,
              averageOrderValue: orderCount > 0 ? totalRevenue / orderCount : 0
            };
          }
        }

        return statsData;
      },
      60 // 60 second cache
    );

    edgeLogger.info('[get-rep-dashboard-stats] Stats fetched', stats);

    return new Response(
      JSON.stringify(stats),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    edgeLogger.error('[get-rep-dashboard-stats] Error', { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
