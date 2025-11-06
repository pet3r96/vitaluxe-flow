import { useQuery } from "@tanstack/react-query";
import { useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, Package, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { StatCardWithChart } from "@/components/dashboard/StatCardWithChart";
import { useQueryClient } from "@tanstack/react-query";

const RepDashboard = () => {
  const { user, effectiveRole, effectiveUserId } = useAuth();
  const queryClient = useQueryClient();

  // Get rep ID
  const { data: repData } = useQuery({
    queryKey: ["rep-data", effectiveUserId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select("*")
        .eq("user_id", effectiveUserId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId && (effectiveRole === 'topline' || effectiveRole === 'downline'),
  });

  // Batched dashboard stats query - combines all 4 queries into one edge function call
  const { data: dashboardStats, isLoading } = useQuery({
    queryKey: ["rep-dashboard-stats-batched", repData?.id, effectiveRole],
    staleTime: 30000, // 30 seconds
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!repData?.id || !effectiveRole) {
        return {
          practiceCount: 0,
          orderCount: 0,
          downlineCount: 0,
          profitStats: null,
        };
      }

      console.log('[Rep Dashboard] Fetching batched stats via edge function');
      const startTime = performance.now();

      const { data, error } = await supabase.functions.invoke('get-rep-dashboard-stats', {
        body: { repId: repData.id, role: effectiveRole }
      });

      const duration = performance.now() - startTime;
      console.log(`[Rep Dashboard] ✅ Batched stats loaded in ${duration.toFixed(0)}ms`);

      if (error) {
        console.error('[Rep Dashboard] Error fetching stats:', error);
        throw error;
      }

      return data;
    },
    enabled: !!repData?.id && !!effectiveRole,
  });

  // Realtime subscriptions for automatic updates
  useEffect(() => {
    if (!repData?.id) return;

    // Subscribe to relevant tables
    const ordersChannel = supabase
      .channel('rep-dashboard-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ["rep-dashboard-stats-batched"],
            refetchType: 'active'
          });
        }
      )
      .subscribe();

    const repsChannel = supabase
      .channel('rep-dashboard-reps')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reps' },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ["rep-dashboard-stats-batched"],
            refetchType: 'active'
          });
        }
      )
      .subscribe();

    const profitsChannel = supabase
      .channel('rep-dashboard-profits')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_profits' },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ["rep-dashboard-stats-batched"],
            refetchType: 'active'
          });
        }
      )
      .subscribe();

    return () => {
      ordersChannel.unsubscribe();
      repsChannel.unsubscribe();
      profitsChannel.unsubscribe();
    };
  }, [repData?.id, queryClient]);

  // Memoize stats array to prevent unnecessary re-renders
  const stats = useMemo(() => effectiveRole === 'topline' ? [
    {
      title: "My Practices",
      value: dashboardStats?.practiceCount || 0,
      icon: Users,
      description: "Active practices in your network",
    },
    {
      title: "My Downlines",
      value: dashboardStats?.downlineCount || 0,
      icon: TrendingUp,
      description: "Active downline reps",
    },
    {
      title: "Total Orders",
      value: dashboardStats?.orderCount || 0,
      icon: Package,
      description: "Orders from all practices",
    },
    {
      title: "Total Profit",
      value: `$${dashboardStats?.profitStats?.totalProfit?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      description: "Commissions + Development Fees",
    },
  ] : [
    {
      title: "Total Orders",
      value: dashboardStats?.orderCount || 0,
      icon: Package,
      description: "Orders from your practices",
    },
    {
      title: "Total Profit",
      value: `$${dashboardStats?.profitStats?.totalProfit?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      description: "All-time earnings",
    },
    {
      title: "Pending Profit",
      value: `$${dashboardStats?.profitStats?.pendingProfit?.toFixed(2) || '0.00'}`,
      icon: Package,
      description: "Orders not yet delivered",
    },
  ], [dashboardStats, effectiveRole]);

  return (
    <div className="patient-container">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gold-text-gradient">
          {effectiveRole === 'topline' ? 'Topline' : 'Downline'} Dashboard
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Overview of your network and performance
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((stat) => (
          <StatCardWithChart
            key={stat.title}
            title={stat.title}
            metricKey={
              stat.title === "My Practices" ? "users" :
              stat.title === "My Downlines" ? "users" :
              stat.title === "Total Orders" ? "orders" :
              stat.title === "Total Profit" ? "revenue" :
              stat.title === "Pending Profit" ? "pending_revenue" :
              "revenue"
            }
            icon={stat.icon}
            description={stat.description}
            currentValue={stat.value}
            role={effectiveRole || "downline"}
            userId={repData?.id}
          />
        ))}
      </div>

      <Card className="patient-card">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl text-primary">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs sm:text-sm text-muted-foreground">
            View detailed reports in the Reports section
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RepDashboard;
