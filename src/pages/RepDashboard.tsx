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
          .select("id")
          .eq("assigned_topline_id", repData.id)
          .eq("role", "downline");
        
        if (downlinesError) throw downlinesError;
        
        const downlineRepIds = downlines?.map(d => d.id) || [];
        // Get rep_ids for this topline and all downlines
        const networkRepIds = [repData.id, ...downlineRepIds];
        
        // Count practices using rep_practice_links (source of truth)
        const { data: practiceLinks, error: linksError } = await supabase
          .from("rep_practice_links")
          .select("practice_id")
          .in("rep_id", networkRepIds);
        
        if (linksError) throw linksError;
        
        if (!practiceLinks?.length) return 0;
        
        // Count active profiles
        const practiceIds = practiceLinks.map(l => l.practice_id);
        const { count, error: countError } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .in("id", practiceIds)
          .eq("active", true);
        
        if (countError) throw countError;
        
        return count || 0;
      }
      
      // Downlines don't show practice count
      return 0;
    },
    enabled: !!repData?.id && !!effectiveUserId && effectiveRole === 'topline',
  });

  // Get order count (using rep_practice_links for consistency)
  const { data: orderCount } = useQuery({
    queryKey: ["rep-order-count", repData?.id, effectiveUserId, effectiveRole],
    staleTime: 0,
    queryFn: async () => {
      if (!repData?.id || !effectiveUserId) return 0;
      
      if (effectiveRole === 'topline') {
        // Get all downlines assigned to this topline
        const { data: downlines, error: downlinesError } = await supabase
          .from("reps")
          .select("id")
          .eq("assigned_topline_id", repData.id)
          .eq("role", "downline")
          .eq("active", true);
        
        if (downlinesError) throw downlinesError;
        
        const downlineRepIds = downlines?.map(d => d.id) || [];
        const networkRepIds = [repData.id, ...downlineRepIds];
        
        // Get all practices via rep_practice_links
        const { data: practiceLinks, error: linksError } = await supabase
          .from("rep_practice_links")
          .select("practice_id")
          .in("rep_id", networkRepIds);
        
        if (linksError) throw linksError;
        
        const practiceIds = Array.from(new Set(practiceLinks?.map(l => l.practice_id) || []));
        
        if (practiceIds.length === 0) return 0;
        
        // Count orders from these practices
        const { count, error } = await supabase
          .from("orders")
          .select("*", { count: 'exact', head: true })
          .in("doctor_id", practiceIds)
          .neq("status", "cancelled")
          .neq("payment_status", "payment_failed");
        
        if (error) throw error;
        return count || 0;
      } else {
        // Downlines: get practices via rep_practice_links
        const { data: practiceLinks, error: linksError } = await supabase
          .from("rep_practice_links")
          .select("practice_id")
          .eq("rep_id", repData.id);
        
        if (linksError) throw linksError;
        
        const practiceIds = practiceLinks?.map(l => l.practice_id) || [];
        
        if (practiceIds.length === 0) return 0;
        
        // Count orders from these practices
        const { count, error } = await supabase
          .from("orders")
          .select("*", { count: 'exact', head: true })
          .in("doctor_id", practiceIds)
          .neq("status", "cancelled")
          .neq("payment_status", "payment_failed");
        
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

  // Get profit stats (commissions + practice dev fees for topline)
  const { data: profitStats } = useQuery({
    queryKey: ["rep-profit-stats", repData?.id, effectiveRole],
    staleTime: 0,
    queryFn: async () => {
      if (!repData?.id) return null;
      
      // 1. Fetch product commissions
      let query = supabase
        .from("order_profits")
        .select(`
          *,
          orders:order_id (status)
        `)
        .eq("is_rx_required", false); // Exclude Rx orders (reps don't earn commission on Rx)
        
      if (effectiveRole === 'topline') {
        query = query.eq("topline_id", repData.id);
      } else {
        query = query.eq("downline_id", repData.id);
      }
      
      const { data: commissionsData, error: commissionsError } = await query;
      if (commissionsError) throw commissionsError;
      
      // 2. Fetch paid Practice Development Fees (topline only)
      let practiceDevFees: any[] = [];
      if (effectiveRole === 'topline') {
        const { data: feesData, error: feesError } = await supabase
          .from("practice_development_fee_invoices")
          .select("amount, payment_status")
          .eq("topline_rep_id", repData.id)
          .eq("payment_status", "paid"); // Only paid fees count as collected
        
        if (feesError) throw feesError;
        practiceDevFees = feesData || [];
      }
      
      // 3. Calculate product commission totals
      const commissionTotal = commissionsData
        .filter(item => item.orders?.status !== 'cancelled')
        .reduce((sum, item) => {
          const profit = effectiveRole === 'topline' ? item.topline_profit : item.downline_profit;
          return sum + (parseFloat(profit?.toString() || '0'));
        }, 0);
      
      const commissionPending = commissionsData
        .filter(item => item.orders?.status !== 'cancelled')
        .filter(item => ['pending', 'processing'].includes(item.orders?.status || ''))
        .reduce((sum, item) => {
          const profit = effectiveRole === 'topline' ? item.topline_profit : item.downline_profit;
          return sum + (parseFloat(profit?.toString() || '0'));
        }, 0);
      
      // 4. Calculate Practice Dev Fee totals (only paid fees)
      const practiceDevTotal = practiceDevFees.reduce((sum, fee) => 
        sum + parseFloat(fee.amount?.toString() || '0'), 0
      );
      
      // 5. Combine totals
      return {
        totalProfit: commissionTotal + practiceDevTotal,
        pendingProfit: commissionPending, // Fees are only counted when paid, so they're never "pending"
        collectedProfit: (commissionTotal - commissionPending) + practiceDevTotal,
      };
    },
    enabled: !!repData?.id,
  });

  const stats = effectiveRole === 'topline' ? [
    {
      title: "My Practices",
      value: practiceCount || 0,
      icon: Users,
      description: "Active practices in your network",
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
      description: "Commissions + Development Fees",
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
    <div className="patient-container">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gold-text-gradient">
          {effectiveRole === 'topline' ? 'Topline' : 'Downline'} Dashboard
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Overview of your network and performance
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="patient-stat-card p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground">
                {stat.title}
              </h3>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-2">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </div>
          );
        })}
      </div>

      <div className="patient-card p-6">
        <h2 className="text-2xl font-semibold mb-4 text-primary text-center">Recent Activity</h2>
        <p className="text-sm text-muted-foreground text-center">
          View detailed reports in the Reports section
        </p>
      </div>
    </div>
  );
};

export default RepDashboard;
