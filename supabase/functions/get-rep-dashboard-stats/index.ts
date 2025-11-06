import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

interface RepDashboardStats {
  practiceCount: number;
  orderCount: number;
  downlineCount: number;
  profitStats: {
    totalProfit: number;
    pendingProfit: number;
    collectedProfit: number;
  } | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { repId, role } = await req.json();
    
    if (!repId || !role) {
      return new Response(JSON.stringify({ error: 'Missing repId or role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Rep Dashboard Stats] Fetching for rep:', repId, 'role:', role);

    const stats: RepDashboardStats = {
      practiceCount: 0,
      orderCount: 0,
      downlineCount: 0,
      profitStats: null,
    };

    // Batch all queries with Promise.all for parallel execution
    const [
      practiceCountResult,
      orderCountResult,
      downlineCountResult,
      profitStatsResult,
    ] = await Promise.all([
      // Practice count (topline only)
      role === 'topline' ? (async () => {
        try {
          // Get all downlines
          const { data: downlines } = await supabase
            .from('reps')
            .select('id')
            .eq('assigned_topline_id', repId)
            .eq('role', 'downline');

          const downlineRepIds = downlines?.map(d => d.id) || [];
          const networkRepIds = [repId, ...downlineRepIds];

          // Get practice links
          const { data: practiceLinks } = await supabase
            .from('rep_practice_links')
            .select('practice_id')
            .in('rep_id', networkRepIds);

          if (!practiceLinks?.length) return 0;

          const practiceIds = practiceLinks.map(l => l.practice_id);
          
          // Count active practices
          const { count } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .in('id', practiceIds)
            .eq('active', true);

          return count || 0;
        } catch (error) {
          console.error('[Rep Dashboard] Practice count error:', error);
          return 0;
        }
      })() : Promise.resolve(0),

      // Order count
      (async () => {
        try {
          if (role === 'topline') {
            // Get downlines
            const { data: downlines } = await supabase
              .from('reps')
              .select('id')
              .eq('assigned_topline_id', repId)
              .eq('role', 'downline')
              .eq('active', true);

            const downlineRepIds = downlines?.map(d => d.id) || [];
            const networkRepIds = [repId, ...downlineRepIds];

            // Get practice links
            const { data: practiceLinks } = await supabase
              .from('rep_practice_links')
              .select('practice_id')
              .in('rep_id', networkRepIds);

            const practiceIds = Array.from(new Set(practiceLinks?.map(l => l.practice_id) || []));

            if (practiceIds.length === 0) return 0;

            // Count orders using SQL aggregation
            const { count } = await supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .in('doctor_id', practiceIds)
              .neq('status', 'cancelled')
              .neq('payment_status', 'payment_failed');

            return count || 0;
          } else {
            // Downline
            const { data: practiceLinks } = await supabase
              .from('rep_practice_links')
              .select('practice_id')
              .eq('rep_id', repId);

            const practiceIds = practiceLinks?.map(l => l.practice_id) || [];

            if (practiceIds.length === 0) return 0;

            const { count } = await supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .in('doctor_id', practiceIds)
              .neq('status', 'cancelled')
              .neq('payment_status', 'payment_failed');

            return count || 0;
          }
        } catch (error) {
          console.error('[Rep Dashboard] Order count error:', error);
          return 0;
        }
      })(),

      // Downline count (topline only)
      role === 'topline' ? (async () => {
        try {
          const { count } = await supabase
            .from('reps')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_topline_id', repId)
            .eq('active', true);

          return count || 0;
        } catch (error) {
          console.error('[Rep Dashboard] Downline count error:', error);
          return 0;
        }
      })() : Promise.resolve(0),

      // Profit stats
      (async () => {
        try {
          // Fetch product commissions
          let query = supabase
            .from('order_profits')
            .select(`
              *,
              orders:order_id (status)
            `)
            .eq('is_rx_required', false);

          if (role === 'topline') {
            query = query.eq('topline_id', repId);
          } else {
            query = query.eq('downline_id', repId);
          }

          const { data: commissionsData } = await query;

          // Fetch practice dev fees (topline only)
          let practiceDevFees: any[] = [];
          if (role === 'topline') {
            const { data: feesData } = await supabase
              .from('practice_development_fee_invoices')
              .select('amount, payment_status')
              .eq('topline_rep_id', repId)
              .eq('payment_status', 'paid');

            practiceDevFees = feesData || [];
          }

          // Calculate totals
          const commissionTotal = (commissionsData || [])
            .filter(item => item.orders?.status !== 'cancelled')
            .reduce((sum, item) => {
              const profit = role === 'topline' ? item.topline_profit : item.downline_profit;
              return sum + (parseFloat(profit?.toString() || '0'));
            }, 0);

          const commissionPending = (commissionsData || [])
            .filter(item => item.orders?.status !== 'cancelled')
            .filter(item => ['pending', 'processing'].includes(item.orders?.status || ''))
            .reduce((sum, item) => {
              const profit = role === 'topline' ? item.topline_profit : item.downline_profit;
              return sum + (parseFloat(profit?.toString() || '0'));
            }, 0);

          const practiceDevTotal = practiceDevFees.reduce((sum, fee) => 
            sum + parseFloat(fee.amount?.toString() || '0'), 0
          );

          return {
            totalProfit: commissionTotal + practiceDevTotal,
            pendingProfit: commissionPending,
            collectedProfit: (commissionTotal - commissionPending) + practiceDevTotal,
          };
        } catch (error) {
          console.error('[Rep Dashboard] Profit stats error:', error);
          return null;
        }
      })(),
    ]);

    stats.practiceCount = practiceCountResult;
    stats.orderCount = orderCountResult;
    stats.downlineCount = downlineCountResult;
    stats.profitStats = profitStatsResult;

    console.log('[Rep Dashboard Stats] Completed:', stats);

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Rep Dashboard Stats] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
