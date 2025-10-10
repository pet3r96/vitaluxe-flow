import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Package, ShoppingCart, Users, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

// Dashboard component with real-time stats
const Dashboard = () => {
  const { user, effectiveRole, effectiveUserId } = useAuth();

  const { data: ordersCount, isLoading: ordersLoading } = useQuery({
    queryKey: ["dashboard-orders-count", effectiveRole, effectiveUserId],
    queryFn: async () => {
      let count = 0;
      
      if (effectiveRole === "doctor") {
        const result: any = await (supabase as any)
          .from("orders")
          .select("*", { count: "exact", head: true })
          .neq("status", "cancelled")
          .eq("doctor_id", effectiveUserId);
        count = result.count || 0;
      } else if (effectiveRole === "provider" as any) {
        const result: any = await (supabase as any)
          .from("orders")
          .select("*", { count: "exact", head: true })
          .neq("status", "cancelled")
          .eq("provider_id", effectiveUserId);
        count = result.count || 0;
      } else {
        const result: any = await (supabase as any)
          .from("orders")
          .select("*", { count: "exact", head: true })
          .neq("status", "cancelled");
        count = result.count || 0;
      }
      
      return count;
    },
  });

  const { data: productsCount, isLoading: productsLoading } = useQuery({
    queryKey: ["dashboard-products-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("active", true);
      return count || 0;
    },
  });

  const { data: usersCount, isLoading: usersLoading } = useQuery({
    queryKey: ["dashboard-users-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("active", true);
      return count || 0;
    },
    enabled: effectiveRole === "admin",
  });

  const { data: pendingRevenue, isLoading: pendingRevenueLoading } = useQuery({
    queryKey: ["dashboard-pending-revenue", effectiveRole, effectiveUserId],
    queryFn: async () => {
      let data: any = null;
      
      if (effectiveRole === "doctor") {
        const result: any = await (supabase as any)
          .from("orders")
          .select("total_amount")
          .neq("status", "cancelled")
          .eq("doctor_id", effectiveUserId)
          .eq("status", "pending");
        data = result.data;
      } else if (effectiveRole === "provider" as any) {
        const result: any = await (supabase as any)
          .from("orders")
          .select("total_amount")
          .neq("status", "cancelled")
          .eq("provider_id", effectiveUserId)
          .eq("status", "pending");
        data = result.data;
      } else {
        const result: any = await (supabase as any)
          .from("orders")
          .select("total_amount")
          .neq("status", "cancelled")
          .eq("status", "pending");
        data = result.data;
      }
      
      const total = data?.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0) || 0;
      return total;
    },
  });

  const { data: collectedRevenue, isLoading: collectedRevenueLoading } = useQuery({
    queryKey: ["dashboard-collected-revenue", effectiveRole, effectiveUserId],
    queryFn: async () => {
      let data: any = null;
      
      if (effectiveRole === "doctor") {
        const result: any = await (supabase as any)
          .from("orders")
          .select("total_amount")
          .neq("status", "cancelled")
          .eq("doctor_id", effectiveUserId)
          .eq("status", "completed");
        data = result.data;
      } else if (effectiveRole === "provider" as any) {
        const result: any = await (supabase as any)
          .from("orders")
          .select("total_amount")
          .neq("status", "cancelled")
          .eq("provider_id", effectiveUserId)
          .eq("status", "completed");
        data = result.data;
      } else {
        const result: any = await (supabase as any)
          .from("orders")
          .select("total_amount")
          .neq("status", "cancelled")
          .eq("status", "completed");
        data = result.data;
      }
      
      const total = data?.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0) || 0;
      return total;
    },
  });

  const stats = [
    {
      title: "Total Orders",
      value: ordersLoading ? "..." : ordersCount?.toString() || "0",
      icon: ShoppingCart,
      description: effectiveRole === "doctor" ? "Your practice orders" : (effectiveRole as any) === "provider" ? "Your orders" : "All orders",
      isLoading: ordersLoading,
    },
    {
      title: "Products",
      value: productsLoading ? "..." : productsCount?.toString() || "0",
      icon: Package,
      description: "Active products",
      isLoading: productsLoading,
    },
    {
      title: "Users",
      value: usersLoading ? "..." : usersCount?.toString() || "0",
      icon: Users,
      description: "Active accounts",
      isLoading: usersLoading,
      hidden: effectiveRole !== "admin",
    },
    {
      title: "Pending Revenue",
      value: pendingRevenueLoading ? "..." : `$${pendingRevenue?.toFixed(2) || "0.00"}`,
      icon: DollarSign,
      description: effectiveRole === "doctor" ? "Practice pending revenue" : (effectiveRole as any) === "provider" ? "Your pending revenue" : "Pending orders revenue",
      isLoading: pendingRevenueLoading,
    },
    {
      title: "Collected Revenue",
      value: collectedRevenueLoading ? "..." : `$${collectedRevenue?.toFixed(2) || "0.00"}`,
      icon: DollarSign,
      description: effectiveRole === "doctor" ? "Practice collected revenue" : (effectiveRole as any) === "provider" ? "Your collected revenue" : "Completed orders revenue",
      isLoading: collectedRevenueLoading,
    },
  ].filter(stat => !stat.hidden);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold gold-text-gradient">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {user?.email}
        </p>
        {effectiveRole && (
          <p className="text-sm text-primary mt-1 capitalize">
            Role: {effectiveRole}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="p-6 bg-card border-border shadow-gold hover:glow-gold transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <stat.icon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </h3>
            {stat.isLoading ? (
              <Skeleton className="h-9 w-20 mt-2" />
            ) : (
              <p className="text-3xl font-bold text-foreground mt-2">
                {stat.value}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-card border-border shadow-gold">
        <h2 className="text-2xl font-semibold mb-4 text-primary">
          Recent Activity
        </h2>
        <p className="text-muted-foreground">
          No recent activity to display.
        </p>
      </Card>
    </div>
  );
};

export default Dashboard;
