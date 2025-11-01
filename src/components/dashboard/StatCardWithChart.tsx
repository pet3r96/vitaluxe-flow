import { useState } from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useMetricTimeSeries, MetricType } from '@/hooks/useMetricTimeSeries';
import { TimePeriod } from '@/lib/chartUtils';
import { cn } from '@/lib/utils';

interface StatCardWithChartProps {
  title: string;
  metricKey: MetricType;
  icon: LucideIcon;
  description: string;
  currentValue?: number | string;
  role: string;
  userId: string;
  valueFormatter?: (value: number) => string;
}

const TIME_PERIODS: Array<{ value: TimePeriod; label: string }> = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '12m', label: '12M' },
];

export function StatCardWithChart({
  title,
  metricKey,
  icon: Icon,
  description,
  currentValue,
  role,
  userId,
  valueFormatter = (v) => v.toString(),
}: StatCardWithChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('7d');
  
  const { data, currentValue: calculatedValue, percentChange, trend, isLoading } = useMetricTimeSeries(
    metricKey,
    selectedPeriod,
    role,
    userId
  );

  const displayValue = currentValue !== undefined ? currentValue : valueFormatter(calculatedValue);
  
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColorClass = trend === 'up' 
    ? 'text-success' 
    : trend === 'down' 
    ? 'text-destructive' 
    : 'text-muted-foreground';

  const chartColor = getChartColor(metricKey);

  return (
    <div className="patient-stat-card p-3 sm:p-4 lg:p-6 group hover:shadow-lg transition-all duration-200 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">
              {title}
            </h3>
            {isLoading ? (
              <Skeleton className="h-6 sm:h-8 lg:h-9 w-16 sm:w-20" />
            ) : (
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white transition-all duration-300 truncate">
                {displayValue}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Time Period Selector */}
      <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2 flex-wrap">
        <p className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1 min-w-0">{description}</p>
        <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
          {TIME_PERIODS.map((period) => (
            <button
              key={period.value}
              onClick={() => setSelectedPeriod(period.value)}
              className={cn(
                'px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-md transition-all duration-200',
                'hover:bg-accent/50',
                selectedPeriod === period.value
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'bg-transparent text-muted-foreground border border-transparent'
              )}
              aria-label={`View last ${period.label}`}
              aria-pressed={selectedPeriod === period.value}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trend Indicator */}
      {!isLoading && (
        <div className={cn('flex items-center gap-1 text-[10px] sm:text-xs font-medium mb-2 sm:mb-3 flex-wrap', trendColorClass)}>
          <TrendIcon className="h-3 w-3 flex-shrink-0" />
          <span className="whitespace-nowrap">
            {trend !== 'neutral' && (trend === 'up' ? '+' : '')}
            {percentChange.toFixed(1)}%
          </span>
          <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">vs last period</span>
        </div>
      )}

      {/* Mini Sparkline Chart */}
      <div className="h-10 sm:h-12 lg:h-14 mt-2 -mx-2 min-w-0">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`gradient-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md">
                        <div className="text-xs font-medium">{payload[0].payload.label}</div>
                        <div className="text-sm font-bold" style={{ color: chartColor }}>
                          {valueFormatter(payload[0].value as number)}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={2}
                fill={`url(#gradient-${metricKey})`}
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function getChartColor(metricKey: MetricType): string {
  switch (metricKey) {
    case 'orders':
    case 'pending_orders':
      return 'hsl(var(--primary))';
    case 'revenue':
    case 'pending_revenue':
      return 'hsl(142, 76%, 36%)'; // green
    case 'users':
      return 'hsl(221, 83%, 53%)'; // blue
    case 'products':
      return 'hsl(262, 83%, 58%)'; // purple
    default:
      return 'hsl(var(--primary))';
  }
}
