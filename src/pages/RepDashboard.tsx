import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, Package, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const RepDashboard = () => {
  const { user, userRole } = useAuth();

  // Get rep ID
  const { data: repData } = useQuery({
    queryKey: ["rep-data", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select("*")
        .eq("user_id", user?.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && (userRole === 'topline' || userRole === 'downline'),
  });

  // Get practice count
  const { data: practiceCount } = useQuery({
    queryKey: ["rep-practice-count", repData?.id, userRole],
    queryFn: async () => {
      if (!repData?.id) return 0;
      
      let query = supabase
        .from("rep_practice_links")
        .select("*", { count: 'exact', head: true });
      
      if (userRole === 'topline') {
        // Topline sees their practices + downline practices
        query = query.or(`rep_id.eq.${repData.id},assigned_topline_id.eq.${repData.id}`);
      } else {
        // Downline sees only their practices
        query = query.eq("rep_id", repData.id);
      }
      
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: !!repData?.id,
  });

  // Get downline count (only for toplines)
  const { data: downlineCount } = useQuery({
    queryKey: ["downline-count", repData?.id],
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
    enabled: !!repData?.id && userRole === 'topline',
  });

  // Get profit stats
  const { data: profitStats } = useQuery({
    queryKey: ["rep-profit-stats", repData?.id, userRole],
    queryFn: async () => {
      if (!repData?.id) return null;
      
      let query = supabase
        .from("order_profits")
        .select("*");
      
      if (userRole === 'topline') {
        query = query.eq("topline_id", repData.id);
      } else {
        query = query.eq("downline_id", repData.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const totalProfit = data.reduce((sum, item) => {
        const profit = userRole === 'topline' ? item.topline_profit : item.downline_profit;
        return sum + (parseFloat(profit?.toString() || '0'));
      }, 0);
      
      const pendingProfit = data
        .filter(item => {
          // Assuming we'd check order status here in real implementation
          return true; // Placeholder
        })
        .reduce((sum, item) => {
          const profit = userRole === 'topline' ? item.topline_profit : item.downline_profit;
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

  const stats = [
    {
      title: "My Practices",
      value: practiceCount || 0,
      icon: Users,
      description: userRole === 'topline' ? "Including downline practices" : "Your assigned practices",
    },
    ...(userRole === 'topline' ? [{
      title: "My Downlines",
      value: downlineCount || 0,
      icon: TrendingUp,
      description: "Active downline reps",
    }] : []),
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
          {userRole === 'topline' ? 'Topline' : 'Downline'} Dashboard
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
