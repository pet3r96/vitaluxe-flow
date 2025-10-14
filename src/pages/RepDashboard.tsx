import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, Package, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const RepDashboard = () => {
  const { user, effectiveRole, effectiveUserId } = useAuth();

  // Get rep ID
  const { data: repData } = useQuery({
    queryKey: ["rep-data", effectiveUserId],
    staleTime: 0,
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

  // Get practice count (only for toplines)
  const { data: practiceCount } = useQuery({
    queryKey: ["rep-practice-count", repData?.id, effectiveUserId, effectiveRole],
    staleTime: 0,
    queryFn: async () => {
      if (!repData?.id || !effectiveUserId) return 0;
      
      if (effectiveRole === 'topline') {
        // Get all downlines assigned to this topline
        const { data: downlines, error: downlinesError } = await supabase
          .from("reps")
          .select("user_id")
          .eq("assigned_topline_id", repData.id)
          .eq("role", "downline");
        
        if (downlinesError) throw downlinesError;
        
        // Get user_ids of all downlines + topline's own user_id
        const networkUserIds = [effectiveUserId, ...(downlines?.map(d => d.user_id) || [])];
        
        // Count practices linked to anyone in the network
        const { count, error } = await supabase
          .from("profiles")
          .select("*", { count: 'exact', head: true })
          .in("linked_topline_id", networkUserIds)
          .eq("active", true);
        
        if (error) throw error;
        return count || 0;
      }
      
      // Downlines don't show practice count
      return 0;
    },
    enabled: !!repData?.id && !!effectiveUserId && effectiveRole === 'topline',
  });

  // Get order count
  const { data: orderCount } = useQuery({
    queryKey: ["rep-order-count", repData?.id, effectiveUserId, effectiveRole],
    staleTime: 0,
    queryFn: async () => {
      if (!repData?.id || !effectiveUserId) return 0;
      
      if (effectiveRole === 'topline') {
        // Get all downlines assigned to this topline
        const { data: downlines, error: downlinesError } = await supabase
          .from("reps")
          .select("user_id")
          .eq("assigned_topline_id", repData.id)
          .eq("role", "downline");
        
        if (downlinesError) throw downlinesError;
        
        const downlineUserIds = downlines?.map(d => d.user_id) || [];
        const networkUserIds = [effectiveUserId, ...downlineUserIds];
        
        // Get all practices in the network
        const { data: practices, error: practicesError } = await supabase
          .from("profiles")
          .select("id")
          .in("linked_topline_id", networkUserIds)
          .eq("active", true);
        
        if (practicesError) throw practicesError;
        
        // Filter OUT downline profiles themselves (they don't place orders, their sub-practices do)
        const practiceIds = practices
          ?.filter(p => !downlineUserIds.includes(p.id))
          .map(p => p.id) || [];
        
        if (practiceIds.length === 0) return 0;
        
        // Count orders from actual practices
        const { count, error } = await supabase
          .from("orders")
          .select("*", { count: 'exact', head: true })
          .in("doctor_id", practiceIds)
          .neq("status", "cancelled");
        
        if (error) throw error;
        return count || 0;
      } else {
        // Downlines: get practices linked to this downline
        const { data: practices, error: practicesError } = await supabase
          .from("profiles")
          .select("id")
          .eq("linked_topline_id", effectiveUserId)
          .eq("active", true);
        
        if (practicesError) throw practicesError;
        
        // Filter out the downline's own profile if it's in there
        const practiceIds = practices
          ?.filter(p => p.id !== effectiveUserId)
          .map(p => p.id) || [];
        
        if (practiceIds.length === 0) return 0;
        
        // Count orders from these practices
        const { count, error } = await supabase
          .from("orders")
          .select("*", { count: 'exact', head: true })
          .in("doctor_id", practiceIds)
          .neq("status", "cancelled");
        
        if (error) throw error;
        return count || 0;
      }
    },
    enabled: !!repData?.id && !!effectiveUserId,
  });

  // Get downline count (only for toplines)
  const { data: downlineCount } = useQuery({
    queryKey: ["downline-count", repData?.id],
    staleTime: 0,
    queryFn: async () => {
      if (!repData?.id) return 0;
      
      const { count, error } = await supabase
        .from("reps")
        .select("*", { count: 'exact', head: true })
        .eq("assigned_topline_id", repData.id)
        .eq("active", true);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!repData?.id && effectiveRole === 'topline',
  });

  // Get profit stats
  const { data: profitStats } = useQuery({
    queryKey: ["rep-profit-stats", repData?.id, effectiveRole],
    staleTime: 0,
    queryFn: async () => {
      if (!repData?.id) return null;
      
      let query = supabase
        .from("order_profits")
        .select("*");
      
      if (effectiveRole === 'topline') {
        query = query.eq("topline_id", repData.id);
      } else {
        query = query.eq("downline_id", repData.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const totalProfit = data.reduce((sum, item) => {
        const profit = effectiveRole === 'topline' ? item.topline_profit : item.downline_profit;
        return sum + (parseFloat(profit?.toString() || '0'));
      }, 0);
      
      const pendingProfit = data
        .filter(item => {
          // Assuming we'd check order status here in real implementation
          return true; // Placeholder
        })
        .reduce((sum, item) => {
          const profit = effectiveRole === 'topline' ? item.topline_profit : item.downline_profit;
          return sum + (parseFloat(profit?.toString() || '0'));
        }, 0);
      
      return {
        totalProfit,
        pendingProfit,
        collectedProfit: totalProfit - pendingProfit,
      };
    },
    enabled: !!repData?.id,
  });

  const stats = effectiveRole === 'topline' ? [
    {
      title: "My Practices",
      value: practiceCount || 0,
      icon: Users,
      description: "Including downline practices",
    },
    {
      title: "My Downlines",
      value: downlineCount || 0,
      icon: TrendingUp,
      description: "Active downline reps",
    },
    {
      title: "Total Orders",
      value: orderCount || 0,
      icon: Package,
      description: "Orders from all practices",
    },
    {
      title: "Total Profit",
      value: `$${profitStats?.totalProfit?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      description: "All-time earnings",
    },
  ] : [
    {
      title: "Total Orders",
      value: orderCount || 0,
      icon: Package,
      description: "Orders from your practices",
    },
    {
      title: "Total Profit",
      value: `$${profitStats?.totalProfit?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      description: "All-time earnings",
    },
    {
      title: "Pending Profit",
      value: `$${profitStats?.pendingProfit?.toFixed(2) || '0.00'}`,
      icon: Package,
      description: "Orders not yet delivered",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {effectiveRole === 'topline' ? 'Topline' : 'Downline'} Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Overview of your network and performance
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            View detailed reports in the Reports section
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RepDashboard;
