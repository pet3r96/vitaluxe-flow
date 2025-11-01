import { format, subDays, subMonths } from 'date-fns';

export type TimePeriod = '24h' | '7d' | '30d' | '12m';

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  label: string;
}

export function getDateRange(period: TimePeriod): { start: Date; end: Date } {
  const end = new Date();
  let start: Date;

  switch (period) {
    case '24h':
      start = subDays(end, 1);
      break;
    case '7d':
      start = subDays(end, 7);
      break;
    case '30d':
      start = subDays(end, 30);
      break;
    case '12m':
      start = subMonths(end, 12);
      break;
  }

  return { start, end };
}

export function formatChartDate(date: string, period: TimePeriod): string {
  const d = new Date(date);
  
  switch (period) {
    case '24h':
      return format(d, 'HH:mm');
    case '7d':
    case '30d':
      return format(d, 'MMM d');
    case '12m':
      return format(d, 'MMM yyyy');
  }
}

export function calculateTrend(current: number, previous: number): {
  percentChange: number;
  trend: 'up' | 'down' | 'neutral';
} {
  if (previous === 0) {
    return { percentChange: current > 0 ? 100 : 0, trend: current > 0 ? 'up' : 'neutral' };
  }

  const percentChange = ((current - previous) / previous) * 100;
  
  return {
    percentChange: Math.round(percentChange * 10) / 10,
    trend: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'neutral'
  };
}

export function aggregateByPeriod(
  data: Array<{ created_at: string; value: number }>,
  period: TimePeriod
): TimeSeriesDataPoint[] {
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

  return Array.from(grouped.entries())
    .map(([date, value]) => ({
      date,
      value,
      label: formatChartDate(date, period)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
