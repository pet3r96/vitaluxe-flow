import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Package, ShoppingCart, Users, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

// Dashboard component with real-time stats
const Dashboard = () => {
  const { user, userRole } = useAuth();

  const { data: ordersCount, isLoading: ordersLoading } = useQuery({
    queryKey: ["dashboard-orders-count", userRole, user?.id],
    queryFn: async () => {
      let query = supabase.from("orders").select("*", { count: "exact", head: true });
      
      if (userRole === "doctor") {
        query = query.eq("doctor_id", user?.id);
      }
      
      const { count } = await query;
      return count || 0;
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
    enabled: userRole === "admin",
  });

  const { data: revenue, isLoading: revenueLoading } = useQuery({
    queryKey: ["dashboard-revenue", userRole, user?.id],
    queryFn: async () => {
      let query = supabase.from("orders").select("total_amount");
      
      if (userRole === "doctor") {
        query = query.eq("doctor_id", user?.id);
      }
      
      query = query.eq("status", "completed");
      
      const { data } = await query;
      const total = data?.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) || 0;
      return total;
    },
  });

  const stats = [
    {
      title: "Total Orders",
      value: ordersLoading ? "..." : ordersCount?.toString() || "0",
      icon: ShoppingCart,
      description: userRole === "doctor" ? "Your orders" : "All orders",
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
      hidden: userRole !== "admin",
    },
    {
      title: "Revenue",
      value: revenueLoading ? "..." : `$${revenue?.toFixed(2) || "0.00"}`,
      icon: DollarSign,
      description: userRole === "doctor" ? "Your revenue" : "Total revenue",
      isLoading: revenueLoading,
    },
  ].filter(stat => !stat.hidden);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold gold-text-gradient">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {user?.email}
        </p>
        {userRole && (
          <p className="text-sm text-primary mt-1 capitalize">
            Role: {userRole}
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
