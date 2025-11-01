import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TimePeriod, getDateRange, calculateTrend, TimeSeriesDataPoint } from '@/lib/chartUtils';
import { format } from 'date-fns';

export type MetricType = 'orders' | 'products' | 'pending_orders' | 'users' | 'revenue' | 'pending_revenue';

interface MetricTimeSeriesResult {
  data: TimeSeriesDataPoint[];
  currentValue: number;
  previousValue: number;
  percentChange: number;
  trend: 'up' | 'down' | 'neutral';
  isLoading: boolean;
  error: any;
}

export function useMetricTimeSeries(
  metricType: MetricType,
  period: TimePeriod,
  effectiveRole: string,
  effectiveUserId: string
): MetricTimeSeriesResult {
  const { data: metricsData, isLoading, error } = useQuery({
    queryKey: ['metric-timeseries', metricType, period, effectiveRole, effectiveUserId],
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      const { start, end } = getDateRange(period);
      const startStr = format(start, 'yyyy-MM-dd HH:mm:ss');
      const endStr = format(end, 'yyyy-MM-dd HH:mm:ss');

      // Get current period data
      const currentData = await fetchMetricData(
        metricType,
        startStr,
        endStr,
        effectiveRole,
        effectiveUserId
      );

      // Get previous period data for comparison
      const prevStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
      const prevStartStr = format(prevStart, 'yyyy-MM-dd HH:mm:ss');
      const prevData = await fetchMetricData(
        metricType,
        prevStartStr,
        startStr,
        effectiveRole,
        effectiveUserId
      );

      return {
        current: currentData,
        previous: prevData
      };
    }
  });

  if (isLoading || !metricsData) {
    return {
      data: [],
      currentValue: 0,
      previousValue: 0,
      percentChange: 0,
      trend: 'neutral',
      isLoading: true,
      error: null
    };
  }

  const currentValue = metricsData.current.reduce((sum, d) => sum + d.value, 0);
  const previousValue = metricsData.previous.reduce((sum, d) => sum + d.value, 0);
  const { percentChange, trend } = calculateTrend(currentValue, previousValue);

  // Format data for chart
  const chartData = generateChartData(metricsData.current, period);

  return {
    data: chartData,
    currentValue,
    previousValue,
    percentChange,
    trend,
    isLoading: false,
    error
  };
}

async function fetchMetricData(
  metricType: MetricType,
  startDate: string,
  endDate: string,
  effectiveRole: string,
  effectiveUserId: string
): Promise<Array<{ created_at: string; value: number }>> {
  switch (metricType) {
    case 'orders':
      return fetchOrdersData(startDate, endDate, effectiveRole, effectiveUserId);
    case 'products':
      return fetchProductsData(startDate, endDate, effectiveRole, effectiveUserId);
    case 'pending_orders':
      return fetchPendingOrdersData(startDate, endDate, effectiveUserId);
    case 'users':
      return fetchUsersData(startDate, endDate);
    case 'revenue':
      return fetchRevenueData(startDate, endDate, effectiveRole, effectiveUserId, 'paid');
    case 'pending_revenue':
      return fetchRevenueData(startDate, endDate, effectiveRole, effectiveUserId, 'pending');
    default:
      return [];
  }
}

async function fetchOrdersData(
  startDate: string,
  endDate: string,
  effectiveRole: string,
  effectiveUserId: string
): Promise<Array<{ created_at: string; value: number }>> {
  if (effectiveRole === 'doctor') {
    const { data } = await supabase
      .from('orders')
      .select('created_at')
      .eq('doctor_id', effectiveUserId)
      .neq('status', 'cancelled')
      .neq('payment_status', 'payment_failed')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    
    return data?.map(d => ({ created_at: d.created_at, value: 1 })) || [];
  } else if (effectiveRole === 'provider') {
    const { data: providerData } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', effectiveUserId)
      .single();
    
    if (!providerData) return [];

    const { data: orderLines } = await supabase
      .from('order_lines')
      .select('orders!inner(created_at, payment_status, status)')
      .eq('provider_id', providerData.id)
      .neq('orders.payment_status', 'payment_failed')
      .neq('orders.status', 'cancelled')
      .gte('orders.created_at', startDate)
      .lte('orders.created_at', endDate);
    
    return orderLines?.map((ol: any) => ({ created_at: ol.orders.created_at, value: 1 })) || [];
  } else if (effectiveRole === 'pharmacy') {
    const { data: pharmacyData } = await supabase
      .from('pharmacies')
      .select('id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();
    
    if (!pharmacyData) return [];

    const { data: orderLines } = await supabase
      .from('order_lines')
      .select('orders!inner(created_at, payment_status, status)')
      .eq('assigned_pharmacy_id', pharmacyData.id)
      .neq('orders.payment_status', 'payment_failed')
      .neq('orders.status', 'cancelled')
      .gte('orders.created_at', startDate)
      .lte('orders.created_at', endDate);
    
    return orderLines?.map((ol: any) => ({ created_at: ol.orders.created_at, value: 1 })) || [];
  }

  const { data } = await supabase
    .from('orders')
    .select('created_at')
    .neq('status', 'cancelled')
    .neq('payment_status', 'payment_failed')
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  
  return data?.map(d => ({ created_at: d.created_at, value: 1 })) || [];
}

async function fetchProductsData(
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
    
    return data?.map(d => ({ created_at: d.created_at, value: 1 })) || [];
  }

  const { data } = await supabase
    .from('products')
    .select('created_at')
    .eq('active', true)
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  
  return data?.map(d => ({ created_at: d.created_at, value: 1 })) || [];
}

async function fetchPendingOrdersData(
  startDate: string,
  endDate: string,
  effectiveUserId: string
): Promise<Array<{ created_at: string; value: number }>> {
  const { data: pharmacyData } = await supabase
    .from('pharmacies')
    .select('id')
    .eq('user_id', effectiveUserId)
    .maybeSingle();
  
  if (!pharmacyData) return [];

  const { data: orderLines } = await supabase
    .from('order_lines')
    .select('orders!inner(created_at, status, payment_status)')
    .eq('assigned_pharmacy_id', pharmacyData.id)
    .eq('orders.status', 'pending')
    .neq('orders.payment_status', 'payment_failed')
    .gte('orders.created_at', startDate)
    .lte('orders.created_at', endDate);
  
  return orderLines?.map((ol: any) => ({ created_at: ol.orders.created_at, value: 1 })) || [];
}

async function fetchUsersData(
  startDate: string,
  endDate: string
): Promise<Array<{ created_at: string; value: number }>> {
  const { data } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('active', true)
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  
  return data?.map(d => ({ created_at: d.created_at, value: 1 })) || [];
}

async function fetchRevenueData(
  startDate: string,
  endDate: string,
  effectiveRole: string,
  effectiveUserId: string,
  paymentStatus: 'paid' | 'pending'
): Promise<Array<{ created_at: string; value: number }>> {
  if (effectiveRole === 'doctor') {
    const { data } = await supabase
      .from('orders')
      .select('created_at, total_amount')
      .eq('doctor_id', effectiveUserId)
      .eq('payment_status', paymentStatus)
      .neq('status', 'cancelled')
      .neq('payment_status', 'payment_failed')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    
    return data?.map(d => ({ created_at: d.created_at, value: Number(d.total_amount) })) || [];
  } else if (effectiveRole === 'provider') {
    const { data: providerData } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', effectiveUserId)
      .single();
    
    if (!providerData) return [];

    const { data: orderLines } = await supabase
      .from('order_lines')
      .select('price, quantity, orders!inner(created_at, payment_status, status)')
      .eq('provider_id', providerData.id)
      .eq('orders.payment_status', paymentStatus)
      .neq('orders.payment_status', 'payment_failed')
      .neq('orders.status', 'cancelled')
      .gte('orders.created_at', startDate)
      .lte('orders.created_at', endDate);
    
    return orderLines?.map((ol: any) => ({ 
      created_at: ol.orders.created_at, 
      value: Number(ol.price) * Number(ol.quantity) 
    })) || [];
  } else if (effectiveRole === 'pharmacy') {
    const { data: pharmacyData } = await supabase
      .from('pharmacies')
      .select('id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();
    
    if (!pharmacyData) return [];

    const { data: orderLines } = await supabase
      .from('order_lines')
      .select('price, quantity, orders!inner(created_at, payment_status, status)')
      .eq('assigned_pharmacy_id', pharmacyData.id)
      .eq('orders.payment_status', paymentStatus)
      .neq('orders.payment_status', 'payment_failed')
      .neq('orders.status', 'cancelled')
      .gte('orders.created_at', startDate)
      .lte('orders.created_at', endDate);
    
    return orderLines?.map((ol: any) => ({ 
      created_at: ol.orders.created_at, 
      value: Number(ol.price) * Number(ol.quantity) 
    })) || [];
  }

  const { data } = await supabase
    .from('orders')
    .select('created_at, total_amount')
    .eq('payment_status', paymentStatus)
    .neq('status', 'cancelled')
    .neq('payment_status', 'payment_failed')
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  
  return data?.map(d => ({ created_at: d.created_at, value: Number(d.total_amount) })) || [];
}

function generateChartData(
  data: Array<{ created_at: string; value: number }>,
  period: TimePeriod
): TimeSeriesDataPoint[] {
  const { start, end } = getDateRange(period);
  const points: TimeSeriesDataPoint[] = [];
  
  // Group data by appropriate interval
  const grouped = new Map<string, number>();
  
  data.forEach(item => {
    const date = new Date(item.created_at);
    let key: string;
    
    switch (period) {
      case '24h':
        key = format(date, 'yyyy-MM-dd HH:00');
        break;
      case '7d':
      case '30d':
        key = format(date, 'yyyy-MM-dd');
        break;
      case '12m':
        key = format(date, 'yyyy-MM');
        break;
    }
    
    grouped.set(key, (grouped.get(key) || 0) + item.value);
  });
  
  // Fill in missing data points
  let current = new Date(start);
  while (current <= end) {
    let key: string;
    
    switch (period) {
      case '24h':
        key = format(current, 'yyyy-MM-dd HH:00');
        current = new Date(current.getTime() + 60 * 60 * 1000); // +1 hour
        break;
      case '7d':
      case '30d':
        key = format(current, 'yyyy-MM-dd');
        current = new Date(current.getTime() + 24 * 60 * 60 * 1000); // +1 day
        break;
      case '12m':
        key = format(current, 'yyyy-MM');
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1); // +1 month
        break;
      default:
        key = format(current, 'yyyy-MM-dd');
        current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }
    
    points.push({
      date: key,
      value: grouped.get(key) || 0,
      label: formatChartLabel(key, period)
    });
  }
  
  return points;
}

function formatChartLabel(date: string, period: TimePeriod): string {
  switch (period) {
    case '24h':
      return date.split(' ')[1]; // Just the hour part
    case '7d':
    case '30d':
      return format(new Date(date), 'MMM d');
    case '12m':
      return format(new Date(date + '-01'), 'MMM');
  }
}
