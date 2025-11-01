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
    <div className="patient-stat-card p-4 sm:p-6 group hover:shadow-lg transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <div className="flex-1">
            <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">
              {title}
            </h3>
            {isLoading ? (
              <Skeleton className="h-8 sm:h-9 w-20" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-foreground transition-all duration-300">
                {displayValue}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Time Period Selector */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">{description}</p>
        <div className="flex gap-1">
          {TIME_PERIODS.map((period) => (
            <button
              key={period.value}
              onClick={() => setSelectedPeriod(period.value)}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded-md transition-all duration-200',
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
        <div className={cn('flex items-center gap-1 text-xs font-medium mb-3', trendColorClass)}>
          <TrendIcon className="h-3 w-3" />
          <span>
            {trend !== 'neutral' && (trend === 'up' ? '+' : '')}
            {percentChange.toFixed(1)}%
          </span>
          <span className="text-muted-foreground">vs last period</span>
        </div>
      )}

      {/* Mini Sparkline Chart */}
      <div className="h-12 sm:h-14 mt-2 -mx-2">
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
