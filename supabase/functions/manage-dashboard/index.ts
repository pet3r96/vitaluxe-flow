import { createAdminClient, createAuthClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { cacheFetch } from '../_shared/cache.ts';

/**
 * Fetch timeseries data for a given metric type
 */
async function fetchTimeseriesData(
  supabase: any,
  metricType: string,
  startDate: string,
  endDate: string,
  effectiveRole: string,
  effectiveUserId: string
): Promise<Array<{ created_at: string; value: number }>> {
  edgeLogger.info('Fetching timeseries data', { 
    metricType, 
    startDate, 
    endDate, 
    effectiveRole 
  });

  let result: Array<{ created_at: string; value: number }> = [];

  switch (metricType) {
    case 'orders':
      result = await fetchOrdersTimeseries(supabase, startDate, endDate, effectiveRole, effectiveUserId);
      break;
    case 'products':
      result = await fetchProductsTimeseries(supabase, startDate, endDate, effectiveRole, effectiveUserId);
      break;
    case 'revenue':
      result = await fetchRevenueTimeseries(supabase, startDate, endDate, effectiveRole, effectiveUserId, 'paid');
      break;
    case 'pending_revenue':
      result = await fetchRevenueTimeseries(supabase, startDate, endDate, effectiveRole, effectiveUserId, 'pending');
      break;
    case 'users':
      result = await fetchUsersTimeseries(supabase, startDate, endDate);
      break;
    case 'pending_orders':
      result = await fetchPendingOrdersTimeseries(supabase, startDate, endDate, effectiveUserId);
      break;
    default:
      edgeLogger.warn('Unknown metric type', { metricType });
      result = [];
  }

  edgeLogger.info('Timeseries data fetched', { 
    metricType, 
    resultCount: result?.length || 0,
    hasData: result && result.length > 0
  });

  return result;
}

async function fetchOrdersTimeseries(
  supabase: any,
  startDate: string,
  endDate: string,
  effectiveRole: string,
  effectiveUserId: string
): Promise<Array<{ created_at: string; value: number }>> {
  edgeLogger.info('Fetching orders timeseries', { effectiveRole, startDate, endDate });

  if (effectiveRole === 'doctor') {
    const { data, error } = await supabase
      .from('orders')
      .select('created_at')
      .eq('doctor_id', effectiveUserId)
      .neq('status', 'cancelled')
      .neq('payment_status', 'payment_failed')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    
    if (error) edgeLogger.error('Orders query failed for doctor', error);
    const result = data?.map((d: any) => ({ created_at: d.created_at, value: 1 })) || [];
    edgeLogger.info('Orders timeseries result for doctor', { count: result.length });
    return result;
  } else if (effectiveRole === 'provider') {
    const { data: providerData, error: providerError } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', effectiveUserId)
      .single();
    
    if (providerError) edgeLogger.error('Provider lookup failed', providerError);
    if (!providerData) {
      edgeLogger.warn('No provider found for user');
      return [];
    }

    const { data: orderLines, error } = await supabase
      .from('order_lines')
      .select('orders!inner(created_at, payment_status, status)')
      .eq('provider_id', providerData.id)
      .neq('orders.payment_status', 'payment_failed')
      .neq('orders.status', 'cancelled')
      .gte('orders.created_at', startDate)
      .lte('orders.created_at', endDate);
    
    if (error) edgeLogger.error('Order lines query failed for provider', error);
    const result = orderLines?.map((ol: any) => ({ created_at: ol.orders.created_at, value: 1 })) || [];
    edgeLogger.info('Orders timeseries result for provider', { count: result.length });
    return result;
  } else if (effectiveRole === 'pharmacy') {
    const { data: pharmacyData, error: pharmacyError } = await supabase
      .from('pharmacies')
      .select('id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();
    
    if (pharmacyError) edgeLogger.error('Pharmacy lookup failed', pharmacyError);
    if (!pharmacyData) {
      edgeLogger.warn('No pharmacy found for user');
      return [];
    }

    const { data: orderLines, error } = await supabase
      .from('order_lines')
      .select('orders!inner(created_at, payment_status, status)')
      .eq('assigned_pharmacy_id', pharmacyData.id)
      .neq('orders.payment_status', 'payment_failed')
      .neq('orders.status', 'cancelled')
      .gte('orders.created_at', startDate)
      .lte('orders.created_at', endDate);
    
    if (error) edgeLogger.error('Order lines query failed for pharmacy', error);
    const result = orderLines?.map((ol: any) => ({ created_at: ol.orders.created_at, value: 1 })) || [];
    edgeLogger.info('Orders timeseries result for pharmacy', { count: result.length });
    return result;
  }
  
  // Admin/staff - all orders
  const { data, error } = await supabase
    .from('orders')
    .select('created_at')
    .neq('status', 'cancelled')
    .neq('payment_status', 'payment_failed')
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  
  if (error) edgeLogger.error('Orders query failed for admin', error);
  const result = data?.map((d: any) => ({ created_at: d.created_at, value: 1 })) || [];
  edgeLogger.info('Orders timeseries result for admin', { count: result.length });
  return result;
}

async function fetchProductsTimeseries(
  supabase: any,
  startDate: string,
  endDate: string,
  effectiveRole: string,
  effectiveUserId: string
): Promise<Array<{ created_at: string; value: number }>> {
  if (effectiveRole === 'pharmacy') {
    const { data: pharmacyData } = await supabase
      .from('pharmacies')
      .select('id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();
    if (!pharmacyData) return [];
    const { data } = await supabase
      .from('product_pharmacies')
      .select('created_at')
      .eq('pharmacy_id', pharmacyData.id)
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    return data?.map((d: any) => ({ created_at: d.created_at, value: 1 })) || [];
  } else if (effectiveRole === 'admin' || effectiveRole === 'staff') {
    const { data } = await supabase
      .from('products')
      .select('created_at')
      .eq('active', true)
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    return data?.map((d: any) => ({ created_at: d.created_at, value: 1 })) || [];
  }
  return [];
}

async function fetchRevenueTimeseries(
  supabase: any,
  startDate: string,
  endDate: string,
  effectiveRole: string,
  effectiveUserId: string,
  status: 'paid' | 'pending'
): Promise<Array<{ created_at: string; value: number }>> {
  const statusFilter = status === 'paid' ? ['paid', 'partially_refunded'] : ['pending', 'processing'];
  
  if (effectiveRole === 'doctor') {
    const { data } = await supabase
      .from('orders')
      .select('created_at, total_amount')
      .eq('doctor_id', effectiveUserId)
      .in('payment_status', statusFilter)
      .neq('status', 'cancelled')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    return data?.map((d: any) => ({ created_at: d.created_at, value: d.total_amount || 0 })) || [];
  } else if (effectiveRole === 'provider') {
    const { data: providerData } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', effectiveUserId)
      .single();
    if (!providerData) return [];
    const { data: orderLines } = await supabase
      .from('order_lines')
      .select('orders!inner(created_at, payment_status, status), price')
      .eq('provider_id', providerData.id)
      .in('orders.payment_status', statusFilter)
      .neq('orders.status', 'cancelled')
      .gte('orders.created_at', startDate)
      .lte('orders.created_at', endDate);
    return orderLines?.map((ol: any) => ({ created_at: ol.orders.created_at, value: ol.price || 0 })) || [];
  } else if (effectiveRole === 'pharmacy') {
    const { data: pharmacyData } = await supabase
      .from('pharmacies')
      .select('id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();
    if (!pharmacyData) return [];
    const { data: orderLines } = await supabase
      .from('order_lines')
      .select('orders!inner(created_at, payment_status, status), price')
      .eq('assigned_pharmacy_id', pharmacyData.id)
      .in('orders.payment_status', statusFilter)
      .neq('orders.status', 'cancelled')
      .gte('orders.created_at', startDate)
      .lte('orders.created_at', endDate);
    return orderLines?.map((ol: any) => ({ created_at: ol.orders.created_at, value: ol.price || 0 })) || [];
  }
  const { data } = await supabase
    .from('orders')
    .select('created_at, total_amount')
    .in('payment_status', statusFilter)
    .neq('status', 'cancelled')
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  return data?.map((d: any) => ({ created_at: d.created_at, value: d.total_amount || 0 })) || [];
}

async function fetchUsersTimeseries(
  supabase: any,
  startDate: string,
  endDate: string
): Promise<Array<{ created_at: string; value: number }>> {
  const { data } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  return data?.map((d: any) => ({ created_at: d.created_at, value: 1 })) || [];
}

async function fetchPendingOrdersTimeseries(
  supabase: any,
  startDate: string,
  endDate: string,
  effectiveUserId: string
): Promise<Array<{ created_at: string; value: number }>> {
  const { data } = await supabase
    .from('orders')
    .select('created_at')
    .eq('doctor_id', effectiveUserId)
    .in('status', ['pending', 'processing'])
    .neq('payment_status', 'payment_failed')
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  return data?.map((d: any) => ({ created_at: d.created_at, value: 1 })) || [];
}

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

    edgeLogger.info('Dashboard action received', { action });

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
        const authHeader = req.headers.get('Authorization');
        const supabase = createAuthClient(authHeader);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          edgeLogger.error('Timeseries auth failed', authError);
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { metricType, period, startDate, endDate, effectiveRole, effectiveUserId } = body;

        edgeLogger.info('Timeseries request', { 
          metricType, 
          period, 
          startDate, 
          endDate, 
          effectiveRole 
        });

        // Calculate previous period dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        const duration = end.getTime() - start.getTime();
        const prevStart = new Date(start.getTime() - duration);
        const prevEnd = start;

        // Fetch current period data with caching
        const cacheKey = `dashboard:${effectiveRole}:${effectiveUserId}:${metricType}:${startDate}:${endDate}`;
        const currentData = await cacheFetch(
          cacheKey,
          async () => {
            edgeLogger.info('Cache miss - fetching timeseries data', { metricType, startDate, endDate });
            return await fetchTimeseriesData(
              supabase,
              metricType,
              startDate,
              endDate,
              effectiveRole,
              effectiveUserId
            );
          },
          60 // 60 seconds TTL
        );

        // Fetch previous period data with caching
        const prevCacheKey = `dashboard:${effectiveRole}:${effectiveUserId}:${metricType}:${prevStart.toISOString()}:${prevEnd.toISOString()}`;
        const previousData = await cacheFetch(
          prevCacheKey,
          async () => {
            edgeLogger.info('Cache miss - fetching previous period data', { metricType });
            return await fetchTimeseriesData(
              supabase,
              metricType,
              prevStart.toISOString(),
              prevEnd.toISOString(),
              effectiveRole,
              effectiveUserId
            );
          },
          60 // 60 seconds TTL
        );

        edgeLogger.info('Timeseries response', { 
          metricType,
          currentCount: currentData?.length || 0,
          previousCount: previousData?.length || 0 
        });

        return new Response(
          JSON.stringify({ 
            current: currentData,
            previous: previousData
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
    edgeLogger.error('Dashboard endpoint error', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
