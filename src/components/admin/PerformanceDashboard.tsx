import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Clock, TrendingUp, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface PerformanceMetric {
  page_name: string;
  avg_load_time: number;
  min_load_time: number;
  max_load_time: number;
  total_loads: number;
  slow_loads: number;
}

export const PerformanceDashboard = () => {
  const { effectiveRole } = useAuth();

  // Only allow admins to view
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['performance-dashboard'],
    queryFn: async () => {
      // Get page load metrics
      const { data, error } = await supabase
        .from('performance_metrics')
        .select('*')
        .eq('metric_type', 'page_load')
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (error) throw error;

      // Aggregate by page
      const pageMetrics = new Map<string, number[]>();
      data?.forEach((metric) => {
        const times = pageMetrics.get(metric.page_name) || [];
        times.push(metric.load_time_ms);
        pageMetrics.set(metric.page_name, times);
      });

      // Calculate statistics
      const aggregated: PerformanceMetric[] = Array.from(pageMetrics.entries()).map(([page, times]) => {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        const slowLoads = times.filter(t => t > 400).length;

        return {
          page_name: page,
          avg_load_time: Math.round(avg),
          min_load_time: Math.round(min),
          max_load_time: Math.round(max),
          total_loads: times.length,
          slow_loads: slowLoads,
        };
      });

      // Sort by average load time (slowest first)
      return aggregated.sort((a, b) => b.avg_load_time - a.avg_load_time);
    },
    enabled: effectiveRole === 'admin',
  });

  // Get overall statistics
  const { data: overallStats } = useQuery({
    queryKey: ['performance-overall-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_metrics')
        .select('load_time_ms, metric_type')
        .eq('metric_type', 'page_load')
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const loadTimes = data.map(d => d.load_time_ms);
      const avg = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
      const p50 = loadTimes.sort((a, b) => a - b)[Math.floor(loadTimes.length * 0.5)];
      const p95 = loadTimes.sort((a, b) => a - b)[Math.floor(loadTimes.length * 0.95)];
      const slowLoads = loadTimes.filter(t => t > 400).length;
      const slowPercentage = (slowLoads / loadTimes.length) * 100;

      return {
        avgLoadTime: Math.round(avg),
        p50LoadTime: Math.round(p50),
        p95LoadTime: Math.round(p95),
        totalMeasurements: loadTimes.length,
        slowLoadsCount: slowLoads,
        slowLoadsPercentage: slowPercentage.toFixed(1),
      };
    },
    enabled: effectiveRole === 'admin',
  });

  if (effectiveRole !== 'admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>Only administrators can view performance metrics.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const getLoadTimeBadge = (time: number) => {
    if (time < 300) return <Badge className="bg-green-500">Fast</Badge>;
    if (time < 500) return <Badge className="bg-yellow-500">OK</Badge>;
    return <Badge variant="destructive">Slow</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Overall Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Load Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats?.avgLoadTime || 0}ms</div>
            <p className="text-xs text-muted-foreground">
              Target: &lt; 400ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P95 Load Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats?.p95LoadTime || 0}ms</div>
            <p className="text-xs text-muted-foreground">
              95th percentile
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loads</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats?.totalMeasurements || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 1000 measurements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slow Loads</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats?.slowLoadsPercentage || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {overallStats?.slowLoadsCount || 0} loads &gt; 400ms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Page Performance Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <CardTitle>Page Performance Breakdown</CardTitle>
          </div>
          <CardDescription>
            Average load times per page (sorted by slowest first)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics?.map((metric) => (
              <div
                key={metric.page_name}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{metric.page_name}</p>
                    {getLoadTimeBadge(metric.avg_load_time)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {metric.total_loads} loads · {metric.slow_loads} slow
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{metric.avg_load_time}ms</p>
                  <p className="text-xs text-muted-foreground">
                    {metric.min_load_time}ms - {metric.max_load_time}ms
                  </p>
                </div>
              </div>
            ))}

            {!metrics || metrics.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No performance data collected yet. Metrics will appear as users navigate the application.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
