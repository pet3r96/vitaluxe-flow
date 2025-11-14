import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface OrdersBreakdownProps {
  data?: Record<string, number>;
}

export function OrdersBreakdown({ data: externalData }: OrdersBreakdownProps) {
  const { effectiveRole, effectiveUserId } = useAuth();

  // Fetch orders data based on role (only if no external data provided)
  const { data: ordersData } = useQuery({
    queryKey: ["orders-breakdown", effectiveUserId, effectiveRole],
    queryFn: async () => {
      if (!effectiveUserId) return null;

      if (effectiveRole === 'pharmacy') {
        // For pharmacies, get pharmacy ID first, then get order lines
        const { data: pharmacyData } = await supabase
          .from('pharmacies')
          .select('id')
          .eq('user_id', effectiveUserId)
          .maybeSingle();

        if (!pharmacyData) {
          return { pending: 0, on_hold: 0, processing: 0, shipped: 0, completed: 0, declined: 0 };
        }

        // Simplified query with limit to prevent timeout
        const { data: orderLines, error: linesError } = await supabase
          .from('order_lines')
          .select(`
            order_id,
            status,
            orders!inner(status, payment_status)
          `)
          .eq('assigned_pharmacy_id', pharmacyData.id)
          .neq('orders.payment_status', 'payment_failed')
          .neq('orders.status', 'cancelled')
          .limit(500);

        if (linesError) throw linesError;

        if (!orderLines || orderLines.length === 0) {
          return { pending: 0, on_hold: 0, processing: 0, shipped: 0, completed: 0, declined: 0 };
        }

        // Group line statuses by unique order_id
        const byOrder = new Map<string, string[]>();
        for (const ol of orderLines as any[]) {
          const arr = byOrder.get(ol.order_id) || [];
          if (ol.status) arr.push(String(ol.status).toLowerCase());
          byOrder.set(ol.order_id, arr);
        }

        // Determine final status per order
        const counts = { pending: 0, on_hold: 0, processing: 0, shipped: 0, completed: 0, declined: 0 } as any;
        for (const [orderId, statuses] of byOrder) {
          const has = (s: string) => statuses.includes(s);
          if (has('denied')) {
            counts.declined++;
          } else if (has('delivered') || has('completed')) {
            counts.completed++;
          } else if (has('shipped')) {
            counts.shipped++;
          } else if (has('processing')) {
            counts.processing++;
          } else if (has('on_hold')) {
            counts.on_hold++;
          } else {
            counts.pending++;
          }
        }

        return counts;
      } else if (effectiveRole === 'provider') {
        // For providers: get only their prescribed order lines
        const { data: providerData } = await supabase
          .from("providers")
          .select("id")
          .eq("user_id", effectiveUserId)
          .maybeSingle();
        
        if (!providerData) {
          return { pending: 0, on_hold: 0, processing: 0, shipped: 0, completed: 0, declined: 0 };
        }

        // Get order lines for this provider with parent order status
        const { data: orderLines, error } = await supabase
          .from('order_lines')
          .select(`
            order_id,
            status,
            orders!inner(status, payment_status)
          `)
          .eq('provider_id', providerData.id);

        if (error) throw error;

        if (!orderLines || orderLines.length === 0) {
          return { pending: 0, on_hold: 0, processing: 0, shipped: 0, completed: 0, declined: 0 };
        }

        // Filter out cancelled parent orders and payment failures
        const filtered = orderLines.filter((ol: any) => 
          ol.orders?.status?.toLowerCase() !== 'cancelled' &&
          ol.orders?.payment_status !== 'payment_failed'
        );

        if (filtered.length === 0) {
          return { pending: 0, on_hold: 0, processing: 0, shipped: 0, completed: 0, declined: 0 };
        }

        // Group by unique order and determine status (same logic as pharmacy)
        const byOrder = new Map<string, string[]>();
        for (const ol of filtered as any[]) {
          const arr = byOrder.get(ol.order_id) || [];
          if (ol.status) arr.push(String(ol.status).toLowerCase());
          byOrder.set(ol.order_id, arr);
        }

        // Determine final status per order (same precedence as pharmacy)
        const counts = { pending: 0, on_hold: 0, processing: 0, shipped: 0, completed: 0, declined: 0 } as any;
        for (const [orderId, statuses] of byOrder) {
          const has = (s: string) => statuses.includes(s);
          if (has('denied')) {
            counts.declined++;
          } else if (has('delivered') || has('completed')) {
            counts.completed++;
          } else if (has('shipped')) {
            counts.shipped++;
          } else if (has('processing')) {
            counts.processing++;
          } else if (has('on_hold')) {
            counts.on_hold++;
          } else {
            counts.pending++;
          }
        }

        console.log('[OrdersBreakdown] Provider counts:', { 
          uniqueOrders: byOrder.size,
          counts,
          totalCalculated: Object.values(counts).reduce((a: any, b: any) => a + b, 0)
        });

        return counts;
      } else if (effectiveRole === 'doctor' || effectiveRole === 'staff') {
        // For practices: get their own orders
        let doctorId = effectiveUserId;
        
        // For staff members, get their practice_id
        if (effectiveRole === 'staff') {
          const { data: staffData } = await supabase
            .from("providers")
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
          .neq('status', 'cancelled');

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
      } else if (effectiveRole === 'admin') {
        // For admin: get ALL orders in the system (excluding cancelled and failed payments)
        const { data: orders, error } = await supabase
          .from('orders')
          .select('status, payment_status')
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

        console.log('[OrdersBreakdown] Admin counts:', counts);
        return counts;
      }

      return { pending: 0, on_hold: 0, processing: 0, shipped: 0, completed: 0, declined: 0 };
    },
    enabled: !externalData && !!effectiveUserId,
  });

  // Use external data if provided, otherwise use fetched data
  const finalData = externalData || ordersData;

  const data = [
    { name: "Pending", value: (finalData?.pending || 0) + (finalData?.on_hold || 0), color: "#FF9A76", colorEnd: "#FF7051", gradient: "from-orange-400 to-orange-500" },
    { name: "Processing", value: finalData?.processing || 0, color: "#A78BFA", colorEnd: "#8B5CF6", gradient: "from-purple-400 to-purple-600" },
    { name: "Shipped", value: finalData?.shipped || 0, color: "#60A5FA", colorEnd: "#3B82F6", gradient: "from-blue-400 to-blue-500" },
    { name: "Completed", value: finalData?.completed || 0, color: "#6EE7B7", colorEnd: "#34D399", gradient: "from-emerald-400 to-emerald-500" },
    { name: "Declined", value: finalData?.declined || 0, color: "#FB7185", colorEnd: "#F43F5E", gradient: "from-rose-400 to-rose-500" },
  ].filter(item => item.value > 0); // Only show items with values

  // Total excludes cancelled orders
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card variant="modern" className="overflow-hidden h-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Orders by Status
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <div className="relative flex flex-col items-center">
          <ResponsiveContainer width="100%" height={220} className="min-h-[220px] sm:min-h-[240px]">
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
                outerRadius={80}
                innerRadius={58}
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
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
                  padding: "12px",
                  zIndex: 9999,
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#ffffff",
                }}
                wrapperStyle={{ zIndex: 9999 }}
                formatter={(value: number) => [`${value} orders`, "Count"]}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center text showing total - positioned absolutely in the donut center */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '10px', height: '220px' }}>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-foreground drop-shadow-lg animate-fade-in">{total}</div>
              <div className="text-xs sm:text-sm text-foreground drop-shadow-md mt-1 font-medium">Total Orders</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
          {data.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2 p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-accent/30 to-accent/10 hover:from-accent/40 hover:to-accent/20 transition-all duration-200 group cursor-pointer"
            >
              <div
                className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-gradient-to-br ${item.gradient} group-hover:scale-110 transition-transform shadow-md flex-shrink-0`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-xs font-medium text-gray-900 dark:text-white truncate">{item.name}</div>
                <div className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">{item.value}</div>
              </div>
              <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 font-mono flex-shrink-0">
                {total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
