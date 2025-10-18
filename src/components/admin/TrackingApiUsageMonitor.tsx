import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, TrendingUp, DollarSign, AlertCircle } from "lucide-react";

interface UsageStats {
  date: string;
  total_calls: number;
  unique_order_lines: number;
  blocked_calls: number;
}

export function TrackingApiUsageMonitor() {
  const [stats, setStats] = useState<UsageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    fetchUsageStats();
  }, []);

  const fetchUsageStats = async () => {
    try {
      setLoading(true);

      // Get rate limit config for cost calculation
      const { data: config } = await supabase
        .from('api_rate_limits_config')
        .select('cost_per_call')
        .eq('api_name', 'amazon_tracking')
        .single();

      const costPerCall = config?.cost_per_call || 0.05;

      // Get usage stats for last 30 days
      const { data, error } = await supabase
        .from('amazon_tracking_api_calls')
        .select('called_at, order_line_id, response_status')
        .gte('called_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('called_at', { ascending: false });

      if (error) throw error;

      // Group by date
      const statsByDate = new Map<string, UsageStats>();
      let totalCallCount = 0;

      data?.forEach((call) => {
        const date = new Date(call.called_at).toISOString().split('T')[0];
        if (!statsByDate.has(date)) {
          statsByDate.set(date, {
            date,
            total_calls: 0,
            unique_order_lines: 0,
            blocked_calls: 0,
          });
        }
        const stat = statsByDate.get(date)!;
        stat.total_calls++;
        totalCallCount++;
        if (call.response_status === 'rate_limited') {
          stat.blocked_calls++;
        }
      });

      setStats(Array.from(statsByDate.values()).sort((a, b) => b.date.localeCompare(a.date)));
      setTotalCost(totalCallCount * costPerCall);
    } catch (error: any) {
      console.error('Error fetching usage stats:', error);
      toast.error('Failed to load API usage statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const totalCalls = stats.reduce((sum, stat) => sum + stat.total_calls, 0);
  const totalBlocked = stats.reduce((sum, stat) => sum + stat.blocked_calls, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCalls}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Based on $0.05/call</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limited</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBlocked}</div>
            <p className="text-xs text-muted-foreground">
              {totalCalls > 0 ? ((totalBlocked / totalCalls) * 100).toFixed(1) : 0}% of requests
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Usage</CardTitle>
          <CardDescription>Amazon Shipping tracking API calls per day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.slice(0, 14).map((stat) => (
              <div key={stat.date} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{stat.date}</span>
                <div className="flex items-center gap-4">
                  <span className="font-medium">{stat.total_calls} calls</span>
                  {stat.blocked_calls > 0 && (
                    <span className="text-xs text-amber-600">
                      ({stat.blocked_calls} blocked)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
