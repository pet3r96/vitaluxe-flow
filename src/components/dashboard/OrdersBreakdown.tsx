import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function OrdersBreakdown() {
  const { effectiveRole, effectiveUserId } = useAuth();

  // Fetch orders data based on role
  const { data: ordersData } = useQuery({
    queryKey: ["orders-breakdown", effectiveUserId, effectiveRole],
    queryFn: async () => {
      if (!effectiveUserId) return null;

      if (effectiveRole === 'pharmacy') {
        // For pharmacies, get pharmacy ID first, then get orders
        const { data: pharmacyData, error: pharmacyError } = await supabase
          .from('pharmacies')
          .select('id')
          .eq('user_id', effectiveUserId)
          .maybeSingle();

        if (pharmacyError) throw pharmacyError;

        if (!pharmacyData) {
          return { pending: 0, on_hold: 0, processing: 0, shipped: 0, completed: 0, declined: 0 };
        }

        // Get order lines assigned to this pharmacy
        const { data: orderLines, error: linesError } = await supabase
          .from('order_lines')
          .select('order_id')
          .eq('assigned_pharmacy_id', pharmacyData.id);

        if (linesError) throw linesError;

        if (!orderLines || orderLines.length === 0) {
          return { pending: 0, on_hold: 0, processing: 0, shipped: 0, completed: 0, declined: 0 };
        }

        // Get unique order IDs
        const orderIds = [...new Set(orderLines.map(line => line.order_id))];

        // Fetch order statuses, excluding cancelled and failed payments
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('status, payment_status')
          .in('id', orderIds)
          .neq('status', 'cancelled')
          .neq('payment_status', 'payment_failed');

        if (ordersError) throw ordersError;

        // Count by status
        const counts = {
          pending: 0,
          on_hold: 0,
          processing: 0,
          shipped: 0,
          completed: 0,
          declined: 0,
        };

        orders?.forEach(order => {
          const status = order.status?.toLowerCase();
          if (status === 'pending') counts.pending++;
          else if (status === 'on_hold') counts.on_hold++;
          else if (status === 'processing') counts.processing++;
          else if (status === 'shipped') counts.shipped++;
          else if (status === 'delivered' || status === 'completed') counts.completed++;
          else if (status === 'declined') counts.declined++;
        });

        return counts;
      } else if (effectiveRole === 'doctor' || effectiveRole === 'provider' || effectiveRole === 'staff') {
        // For practices: get their own orders
        let doctorId = effectiveUserId;
        
        // For staff members, get their practice_id
        if (effectiveRole === 'staff') {
          const { data: staffData } = await supabase
            .from("practice_staff")
            .select("practice_id")
            .eq("user_id", effectiveUserId)
            .eq("active", true)
            .maybeSingle();
          
          if (staffData?.practice_id) {
            doctorId = staffData.practice_id;
          }
        }

        const { data: orders, error } = await supabase
          .from('orders')
          .select('status, payment_status')
          .eq('doctor_id', doctorId)
          .neq('status', 'cancelled')
          .neq('payment_status', 'payment_failed');

        if (error) throw error;

        const counts = {
          pending: 0,
          on_hold: 0,
          processing: 0,
          shipped: 0,
          completed: 0,
          declined: 0,
        };

        orders?.forEach(order => {
          const status = order.status?.toLowerCase();
          if (status === 'pending') counts.pending++;
          else if (status === 'on_hold') counts.on_hold++;
          else if (status === 'processing') counts.processing++;
          else if (status === 'shipped') counts.shipped++;
          else if (status === 'delivered' || status === 'completed') counts.completed++;
          else if (status === 'declined') counts.declined++;
        });

        return counts;
      }

      return { pending: 0, on_hold: 0, processing: 0, shipped: 0, completed: 0, declined: 0 };
    },
    enabled: !!effectiveUserId,
  });

  const data = [
    { name: "Pending", value: (ordersData?.pending || 0) + (ordersData?.on_hold || 0), color: "#FF9A76", colorEnd: "#FF7051", gradient: "from-orange-400 to-orange-500" },
    { name: "Processing", value: ordersData?.processing || 0, color: "#A78BFA", colorEnd: "#8B5CF6", gradient: "from-purple-400 to-purple-600" },
    { name: "Shipped", value: ordersData?.shipped || 0, color: "#60A5FA", colorEnd: "#3B82F6", gradient: "from-blue-400 to-blue-500" },
    { name: "Completed", value: ordersData?.completed || 0, color: "#6EE7B7", colorEnd: "#34D399", gradient: "from-emerald-400 to-emerald-500" },
    { name: "Declined", value: ordersData?.declined || 0, color: "#FB7185", colorEnd: "#F43F5E", gradient: "from-rose-400 to-rose-500" },
  ].filter(item => item.value > 0); // Only show items with values

  // Total excludes cancelled orders
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card variant="modern" className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Orders by Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative flex flex-col items-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <defs>
                {data.map((entry, index) => (
                  <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                    <stop offset="100%" stopColor={entry.colorEnd} stopOpacity={0.85} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={70}
                innerRadius={45}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#gradient-${index})`}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                    strokeWidth={2}
                    stroke="hsl(var(--background))"
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
                  padding: "12px",
                }}
                formatter={(value: number) => [`${value} orders`, "Count"]}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center text showing total - positioned absolutely in the donut center */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white animate-fade-in">{total}</div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Total Orders</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {data.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-br from-accent/30 to-accent/10 hover:from-accent/40 hover:to-accent/20 transition-all duration-200 group cursor-pointer"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${item.gradient} group-hover:scale-110 transition-transform shadow-md`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 dark:text-white truncate">{item.name}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">{item.value}</div>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                {total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
