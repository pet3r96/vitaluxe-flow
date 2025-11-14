import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAuthClient } from "../_shared/supabaseAdmin.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimeSeriesRequest {
  metricType: 'orders' | 'products' | 'pending_orders' | 'users' | 'revenue' | 'pending_revenue';
  period: '24h' | '7d' | '30d' | '90d';
  startDate: string;
  endDate: string;
  effectiveRole: string;
  effectiveUserId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = createAuthClient(authHeader);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: TimeSeriesRequest = await req.json();
    const { metricType, period, startDate, endDate, effectiveRole, effectiveUserId } = body;

    // Determine granularity based on period
    const granularity = period === '24h' ? 'hour' : 
                       period === '7d' ? 'day' :
                       period === '30d' ? 'day' : 'week';

    let currentData: any[] = [];
    let previousData: any[] = [];

    // Calculate previous period dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - duration);

    switch (metricType) {
      case 'orders':
        currentData = await fetchOrdersTimeSeries(supabase, startDate, endDate, granularity, effectiveRole, effectiveUserId);
        previousData = await fetchOrdersTimeSeries(supabase, prevStart.toISOString(), startDate, granularity, effectiveRole, effectiveUserId);
        break;
      
      case 'revenue':
        currentData = await fetchRevenueTimeSeries(supabase, startDate, endDate, granularity, effectiveRole, effectiveUserId, 'paid');
        previousData = await fetchRevenueTimeSeries(supabase, prevStart.toISOString(), startDate, granularity, effectiveRole, effectiveUserId, 'paid');
        break;
      
      case 'pending_revenue':
        currentData = await fetchRevenueTimeSeries(supabase, startDate, endDate, granularity, effectiveRole, effectiveUserId, 'pending');
        previousData = await fetchRevenueTimeSeries(supabase, prevStart.toISOString(), startDate, granularity, effectiveRole, effectiveUserId, 'pending');
        break;
      
      case 'pending_orders':
        currentData = await fetchPendingOrdersTimeSeries(supabase, startDate, endDate, granularity, effectiveUserId);
        previousData = await fetchPendingOrdersTimeSeries(supabase, prevStart.toISOString(), startDate, granularity, effectiveUserId);
        break;
      
      case 'users':
        currentData = await fetchUsersTimeSeries(supabase, startDate, endDate, granularity);
        previousData = await fetchUsersTimeSeries(supabase, prevStart.toISOString(), startDate, granularity);
        break;
      
      default:
        currentData = [];
        previousData = [];
    }

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
  } catch (error) {
    console.error('Error in get-metric-timeseries:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function fetchOrdersTimeSeries(
  supabase: any,
  startDate: string,
  endDate: string,
  granularity: string,
  role: string,
  userId: string
) {
  let query = `
    SELECT 
      date_trunc('${granularity}', created_at) as period,
      COUNT(*)::integer as value
    FROM orders
    WHERE created_at >= '${startDate}'
      AND created_at <= '${endDate}'
      AND status != 'cancelled'
      AND payment_status != 'payment_failed'
  `;

  if (role === 'doctor') {
    query += ` AND doctor_id = '${userId}'`;
  } else if (role === 'provider') {
    // Get provider ID first
    const { data: provider } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();
    
    if (provider) {
      query = `
        SELECT 
          date_trunc('${granularity}', o.created_at) as period,
          COUNT(DISTINCT ol.order_id)::integer as value
        FROM order_lines ol
        INNER JOIN orders o ON ol.order_id = o.id
        WHERE o.created_at >= '${startDate}'
          AND o.created_at <= '${endDate}'
          AND o.status != 'cancelled'
          AND o.payment_status != 'payment_failed'
          AND ol.provider_id = '${provider.id}'
        GROUP BY period
        ORDER BY period
      `;
      const { data } = await supabase.rpc('exec_sql', { sql: query });
      return data || [];
    }
  } else if (role === 'pharmacy') {
    // Get pharmacy ID first
    const { data: pharmacy } = await supabase
      .from('pharmacies')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (pharmacy) {
      query = `
        SELECT 
          date_trunc('${granularity}', ol.created_at) as period,
          COUNT(DISTINCT ol.order_id)::integer as value
        FROM order_lines ol
        WHERE ol.created_at >= '${startDate}'
          AND ol.created_at <= '${endDate}'
          AND ol.assigned_pharmacy_id = '${pharmacy.id}'
        GROUP BY period
        ORDER BY period
      `;
      const { data } = await supabase.rpc('exec_sql', { sql: query });
      return data || [];
    }
  }

  query += ` GROUP BY period ORDER BY period`;

  const { data } = await supabase.rpc('exec_sql', { sql: query });
  return data || [];
}

async function fetchRevenueTimeSeries(
  supabase: any,
  startDate: string,
  endDate: string,
  granularity: string,
  role: string,
  userId: string,
  paymentStatus: string
) {
  const statusFilter = paymentStatus === 'paid' 
    ? "payment_status = 'paid'" 
    : "payment_status IN ('pending', 'processing')";

  let query = `
    SELECT 
      date_trunc('${granularity}', created_at) as period,
      SUM(total_amount)::numeric as value
    FROM orders
    WHERE created_at >= '${startDate}'
      AND created_at <= '${endDate}'
      AND status != 'cancelled'
      AND ${statusFilter}
  `;

  if (role === 'doctor') {
    query += ` AND doctor_id = '${userId}'`;
  } else if (role === 'provider') {
    // Get provider ID first
    const { data: provider } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();
    
    if (provider) {
      query = `
        SELECT 
          date_trunc('${granularity}', o.created_at) as period,
          SUM(o.total_amount)::numeric as value
        FROM order_lines ol
        INNER JOIN orders o ON ol.order_id = o.id
        WHERE o.created_at >= '${startDate}'
          AND o.created_at <= '${endDate}'
          AND o.status != 'cancelled'
          AND ${statusFilter}
          AND ol.provider_id = '${provider.id}'
        GROUP BY period
        ORDER BY period
      `;
      const { data } = await supabase.rpc('exec_sql', { sql: query });
      return data || [];
    }
  }

  query += ` GROUP BY period ORDER BY period`;

  const { data } = await supabase.rpc('exec_sql', { sql: query });
  return data || [];
}

async function fetchPendingOrdersTimeSeries(
  supabase: any,
  startDate: string,
  endDate: string,
  granularity: string,
  userId: string
) {
  const query = `
    SELECT 
      date_trunc('${granularity}', created_at) as period,
      COUNT(*)::integer as value
    FROM orders
    WHERE created_at >= '${startDate}'
      AND created_at <= '${endDate}'
      AND doctor_id = '${userId}'
      AND status IN ('pending', 'new')
    GROUP BY period
    ORDER BY period
  `;

  const { data } = await supabase.rpc('exec_sql', { sql: query });
  return data || [];
}

async function fetchUsersTimeSeries(
  supabase: any,
  startDate: string,
  endDate: string,
  granularity: string
) {
  const query = `
    SELECT 
      date_trunc('${granularity}', created_at) as period,
      COUNT(*)::integer as value
    FROM profiles
    WHERE created_at >= '${startDate}'
      AND created_at <= '${endDate}'
    GROUP BY period
    ORDER BY period
  `;

  const { data } = await supabase.rpc('exec_sql', { sql: query });
  return data || [];
}
