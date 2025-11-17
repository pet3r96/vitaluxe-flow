import { createAdminClient, createAuthClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Consolidated Dashboard Management Endpoint
 * Actions: summary, usage, timeseries
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    console.log('[manage-dashboard] Action:', action);

    switch (action) {
      case 'summary': {
        // From get-dashboard-stats
        const supabase = createAdminClient();
        const authHeader = req.headers.get('Authorization');
        
        if (!authHeader) {
          return new Response(
            JSON.stringify({ error: 'Missing authorization header' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        
        if (userError || !userData?.user) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const userId = userData.user.id;
        const { role, isImpersonating, effectiveUserId } = body;
        const targetUserId = isImpersonating && effectiveUserId ? effectiveUserId : userId;

        const stats: Record<string, number> = {
          ordersCount: 0,
          productsCount: 0,
          pendingOrdersCount: 0,
          usersCount: 0,
          pendingRevenue: 0,
          collectedRevenue: 0,
        };

        const promises: Promise<void>[] = [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

        // Orders Count
        promises.push(
          (async () => {
            let count = 0;
            
            if (role === 'doctor') {
              const { count: orderCount } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .neq('status', 'cancelled')
                .neq('payment_status', 'payment_failed')
                .eq('doctor_id', targetUserId)
                .gte('created_at', thirtyDaysAgoISO);
              count = orderCount || 0;
            } else if (role === 'provider') {
              const { data: providerData } = await supabase
                .from('providers')
                .select('id')
                .eq('user_id', targetUserId)
                .single();
              
              if (providerData) {
                const { data, error } = await supabase
                  .rpc('count_provider_orders', {
                    p_provider_id: providerData.id
                  });
                
                if (!error) count = data || 0;
              }
            } else if (role === 'pharmacy') {
              const { data: pharmacyData } = await supabase
                .from('pharmacies')
                .select('id')
                .eq('user_id', targetUserId)
                .maybeSingle();
              
              if (pharmacyData) {
                const { data, error } = await supabase
                  .rpc('count_pharmacy_orders', {
                    p_pharmacy_id: pharmacyData.id
                  });
                
                if (!error) count = data || 0;
              }
            } else if (role === 'admin') {
              const { count: orderCount } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .neq('status', 'cancelled')
                .neq('payment_status', 'payment_failed')
                .gte('created_at', thirtyDaysAgoISO);
              count = orderCount || 0;
            }
            
            stats.ordersCount = count;
          })()
        );

        // Products Count
        promises.push(
          (async () => {
            let count = 0;
            
            if (role === 'pharmacy') {
              const { data: pharmacyData } = await supabase
                .from('pharmacies')
                .select('id')
                .eq('user_id', targetUserId)
                .maybeSingle();
              
              if (pharmacyData) {
                const { count: productCount } = await supabase
                  .from('product_pharmacies')
                  .select('*', { count: 'exact', head: true })
                  .eq('pharmacy_id', pharmacyData.id);
                count = productCount || 0;
              }
            } else if ((role === 'admin' || role === 'staff') && !isImpersonating) {
              const { count: productCount } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('active', true);
              count = productCount || 0;
            }
            
            stats.productsCount = count;
          })()
        );

        await Promise.all(promises);

        return new Response(
          JSON.stringify(stats),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }

      case 'usage': {
        // From get-practice-usage-stats
        const supabaseClient = createAuthClient(req.headers.get('Authorization'));
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { practiceId, startDate, endDate } = body;

        if (!practiceId) {
          throw new Error('Practice ID is required');
        }

        // Build query for usage logs
        let query = supabaseClient
          .from('usage_logs')
          .select(`
            *,
            providers!usage_logs_provider_id_fkey(id, user_id),
            patient_accounts!usage_logs_patient_id_fkey(id, first_name, last_name)
          `)
          .eq('practice_id', practiceId)
          .order('created_at', { ascending: false });

        if (startDate) query = query.gte('start_time', startDate);
        if (endDate) query = query.lte('end_time', endDate);

        const { data: usageLogs, error: usageError } = await query;
        if (usageError) throw usageError;

        const totalMinutes = usageLogs?.reduce((sum, log) => sum + log.duration_minutes, 0) || 0;
        const totalSessions = usageLogs?.length || 0;

        return new Response(
          JSON.stringify({
            totalMinutes,
            totalSessions,
            usageLogs: usageLogs || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'timeseries': {
        // From get-metric-timeseries (simplified version)
        const authHeader = req.headers.get('Authorization');
        const supabase = createAuthClient(authHeader);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { metricType, period, startDate, endDate, effectiveRole, effectiveUserId } = body;

        // Return basic timeseries data structure
        return new Response(
          JSON.stringify({ 
            current: [],
            previous: []
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error('[manage-dashboard] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
