import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Package, ShoppingCart, Users, DollarSign, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

// Dashboard component with real-time stats
const Dashboard = () => {
  const { user, effectiveRole, effectiveUserId, isImpersonating } = useAuth();

  const { data: ordersCount, isLoading: ordersLoading } = useQuery({
    queryKey: ["dashboard-orders-count", effectiveRole, effectiveUserId],
    staleTime: 0,
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
        // Count distinct orders that have at least one order_line by this provider
        const { data: orderLines } = await supabase
          .from("order_lines")
          .select("order_id");
        
        // Filter by provider from providers table
        const { data: providerData } = await supabase
          .from("providers")
          .select("id")
          .eq("user_id", effectiveUserId)
          .single();
        
        if (providerData) {
          const { data: providerOrderLines } = await supabase
            .from("order_lines")
            .select("order_id")
            .eq("provider_id", providerData.id);
          
          // Get unique order IDs
          const uniqueOrderIds = [...new Set(providerOrderLines?.map(ol => ol.order_id) || [])];
          count = uniqueOrderIds.length;
        }
      } else if (effectiveRole === "pharmacy") {
        // Get pharmacy ID first
        const { data: pharmacyData } = await supabase
          .from("pharmacies")
          .select("id")
          .eq("user_id", effectiveUserId)
          .maybeSingle();
        
        if (pharmacyData) {
          // Count distinct orders that have at least one order_line assigned to this pharmacy
          const { data: orderLines } = await supabase
            .from("order_lines")
            .select("order_id")
            .eq("assigned_pharmacy_id", pharmacyData.id);
          
          // Get unique order IDs (since one order can have multiple lines)
          const uniqueOrderIds = [...new Set(orderLines?.map(ol => ol.order_id) || [])];
          count = uniqueOrderIds.length;
        } else {
          count = 0; // No pharmacy found for this user
        }
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
    queryKey: ["dashboard-products-count", effectiveRole, effectiveUserId],
    staleTime: 0,
    queryFn: async () => {
      if (effectiveRole === "pharmacy") {
        const { data: pharmacyData } = await supabase
          .from("pharmacies")
          .select("id")
          .eq("user_id", effectiveUserId)
          .maybeSingle();
        
        if (pharmacyData) {
          const { count } = await supabase
            .from("product_pharmacies")
            .select("*", { count: "exact", head: true })
            .eq("pharmacy_id", pharmacyData.id);
          
          return count || 0;
        }
        return 0;
      } else if (effectiveRole === "admin" && !isImpersonating) {
        const { count } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("active", true);
        return count || 0;
      } else {
        // Doctor, provider, topline, downline - use visibility filter
        try {
          const { data: visibleProducts, error } = await supabase.rpc(
            'get_visible_products_for_effective_user' as any,
            { p_effective_user_id: effectiveUserId }
          ) as { data: Array<{ id: string }> | null; error: any };

          console.info('Dashboard visible products', { effectiveUserId, effectiveRole, isImpersonating, count: visibleProducts?.length || 0 });
          
          if (error) {
            console.error('Visibility RPC error:', error);
            return 0;
          }
          
          return visibleProducts?.length || 0;
        } catch (error) {
          console.error('Error checking product visibility:', error);
          return 0;
        }
      }
    },
  });

  const { data: pendingOrdersCount, isLoading: pendingOrdersLoading } = useQuery({
    queryKey: ["dashboard-pending-orders-count", effectiveRole, effectiveUserId],
    staleTime: 0,
    queryFn: async () => {
      if (effectiveRole !== "pharmacy") {
        return 0;
      }
      
      // Get pharmacy ID first
      const { data: pharmacyData } = await supabase
        .from("pharmacies")
        .select("id")
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      
      if (!pharmacyData) {
        return 0;
      }
      
      // Count distinct orders where:
      // 1. At least one order_line is assigned to this pharmacy
      // 2. The order status is 'pending'
      const { data: orderLines } = await supabase
        .from("order_lines")
        .select(`
          order_id,
          orders!inner(status)
        `)
        .eq("assigned_pharmacy_id", pharmacyData.id)
        .eq("orders.status", "pending");
      
      // Get unique order IDs (one order can have multiple lines)
      const uniqueOrderIds = [...new Set(orderLines?.map(ol => ol.order_id) || [])];
      return uniqueOrderIds.length;
    },
    enabled: effectiveRole === "pharmacy",
  });

  const { data: usersCount, isLoading: usersLoading } = useQuery({
    queryKey: ["dashboard-users-count"],
    staleTime: 0,
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
    staleTime: 0,
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
        // Get provider id first
        const { data: providerData } = await supabase
          .from("providers")
          .select("id")
          .eq("user_id", effectiveUserId)
          .single();
        
        if (providerData) {
          // Sum order line prices where provider prescribed and order is pending
          const { data: orderLines } = await supabase
            .from("order_lines")
            .select(`
              price,
              quantity,
              orders!inner(status)
            `)
            .eq("provider_id", providerData.id)
            .eq("orders.status", "pending");
          
          // Calculate total from order lines (price * quantity)
          const total = orderLines?.reduce((sum: number, line: any) => 
            sum + (Number(line.price || 0) * Number(line.quantity || 1)), 0) || 0;
          return total;
        }
        return 0;
      } else if (effectiveRole === "pharmacy") {
        // Get pharmacy ID first
        const { data: pharmacyData } = await supabase
          .from("pharmacies")
          .select("id")
          .eq("user_id", effectiveUserId)
          .maybeSingle();
        
        if (pharmacyData) {
          // Sum order line prices where pharmacy is assigned and order is pending
          const { data: orderLines } = await supabase
            .from("order_lines")
            .select(`
              price,
              quantity,
              orders!inner(status)
            `)
            .eq("assigned_pharmacy_id", pharmacyData.id)
            .eq("orders.status", "pending");
          
          // Calculate total from order lines (price * quantity)
          const total = orderLines?.reduce((sum: number, line: any) => 
            sum + (Number(line.price || 0) * Number(line.quantity || 1)), 0) || 0;
          return total;
        }
        return 0;
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
    staleTime: 0,
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
        // Get provider id first
        const { data: providerData } = await supabase
          .from("providers")
          .select("id")
          .eq("user_id", effectiveUserId)
          .single();
        
        if (providerData) {
          // Sum order line prices where provider prescribed and order is completed
          const { data: orderLines } = await supabase
            .from("order_lines")
            .select(`
              price,
              quantity,
              orders!inner(status)
            `)
            .eq("provider_id", providerData.id)
            .eq("orders.status", "completed");
          
          // Calculate total from order lines (price * quantity)
          const total = orderLines?.reduce((sum: number, line: any) => 
            sum + (Number(line.price || 0) * Number(line.quantity || 1)), 0) || 0;
          return total;
        }
        return 0;
      } else if (effectiveRole === "pharmacy") {
        // Get pharmacy ID first
        const { data: pharmacyData } = await supabase
          .from("pharmacies")
          .select("id")
          .eq("user_id", effectiveUserId)
          .maybeSingle();
        
        if (pharmacyData) {
          // Sum order line prices where pharmacy is assigned and order is completed
          const { data: orderLines } = await supabase
            .from("order_lines")
            .select(`
              price,
              quantity,
              orders!inner(status)
            `)
            .eq("assigned_pharmacy_id", pharmacyData.id)
            .eq("orders.status", "completed");
          
          // Calculate total from order lines (price * quantity)
          const total = orderLines?.reduce((sum: number, line: any) => 
            sum + (Number(line.price || 0) * Number(line.quantity || 1)), 0) || 0;
          return total;
        }
        return 0;
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
      title: "Pending Orders",
      value: pendingOrdersLoading ? "..." : pendingOrdersCount?.toString() || "0",
      icon: Clock,
      description: "Orders awaiting fulfillment",
      isLoading: pendingOrdersLoading,
      hidden: effectiveRole !== "pharmacy",
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
      hidden: effectiveRole === "pharmacy" || effectiveRole === "provider",
    },
    {
      title: "Collected Revenue",
      value: collectedRevenueLoading ? "..." : `$${collectedRevenue?.toFixed(2) || "0.00"}`,
      icon: DollarSign,
      description: effectiveRole === "doctor" ? "Practice collected revenue" : (effectiveRole as any) === "provider" ? "Your collected revenue" : "Completed orders revenue",
      isLoading: collectedRevenueLoading,
      hidden: effectiveRole === "pharmacy" || effectiveRole === "provider",
    },
  ].filter(stat => !stat.hidden);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gold-text-gradient">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Welcome back, {user?.email}
        </p>
        {effectiveRole && (
          <p className="text-sm text-primary mt-1 capitalize">
            Role: {effectiveRole}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="p-4 sm:p-6 bg-card border-border shadow-gold hover:glow-gold transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <stat.icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
            <h3 className="text-xs sm:text-sm font-medium text-muted-foreground">
              {stat.title}
            </h3>
            {stat.isLoading ? (
              <Skeleton className="h-8 sm:h-9 w-16 sm:w-20 mt-2" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-2">
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
