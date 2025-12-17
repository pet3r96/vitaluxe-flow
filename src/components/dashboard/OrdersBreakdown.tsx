import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface OrdersBreakdownProps {
  data?: Record<string, number>;
}

export function OrdersBreakdown({ data: externalData }: OrdersBreakdownProps) {
  const { effectiveRole, effectiveUserId, effectivePracticeId } = useAuth();

  // Fetch orders data from order_lines table
  const { data: ordersData } = useQuery({
    queryKey: ["orders-breakdown", effectiveUserId, effectiveRole, effectivePracticeId],
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!effectiveUserId) return null;

      // Calculate 90-day date range for performance
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      // Query order_lines for status counts
      const { data: orderLines, error } = await supabase
        .from('order_lines')
        .select('status')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) {
        logger.error('Error fetching orders breakdown', error);
        return { pending: 0, on_hold: 0, processing: 0, shipped: 0, completed: 0, declined: 0 };
      }

      // Aggregate status counts
      const counts = { pending: 0, on_hold: 0, processing: 0, shipped: 0, completed: 0, declined: 0 };
      (orderLines || []).forEach((line) => {
        const status = String(line.status).toLowerCase();
        
        // Map status to our display categories
        if (status === 'new' || status === 'pending') {
          counts.pending += 1;
        } else if (status === 'on_hold') {
          counts.on_hold += 1;
        } else if (status === 'processing' || status === 'approved') {
          counts.processing += 1;
        } else if (status === 'shipped' || status === 'in_transit') {
          counts.shipped += 1;
        } else if (status === 'delivered' || status === 'completed') {
          counts.completed += 1;
        } else if (status === 'declined' || status === 'denied') {
          counts.declined += 1;
        }
      });

      return counts;
    },
    enabled: !!effectiveUserId,
  });

  // Use external data if provided, otherwise use fetched data
  const dataSource = externalData || ordersData;

  if (!dataSource) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Orders Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Loading orders...
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: "Pending", value: dataSource.pending || 0, color: "#94a3b8" },
    { name: "On Hold", value: dataSource.on_hold || 0, color: "#fbbf24" },
    { name: "Processing", value: dataSource.processing || 0, color: "#60a5fa" },
    { name: "Shipped", value: dataSource.shipped || 0, color: "#a78bfa" },
    { name: "Completed", value: dataSource.completed || 0, color: "#4ade80" },
    { name: "Declined", value: dataSource.declined || 0, color: "#f87171" },
  ].filter(item => item.value > 0);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Orders Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No orders to display
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Orders Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={70}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [
                  `${value} (${((value / total) * 100).toFixed(0)}%)`,
                  name
                ]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center gap-2 min-w-0">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground truncate">
                {item.name}: {item.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
