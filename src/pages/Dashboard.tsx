import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Card } from "@/components/ui/card";
import { Package, ShoppingCart, Users, DollarSign, Clock, Sparkles, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import { PRO_MONTHLY_PRICE_STR, TRIAL_DESCRIPTION } from "@/lib/pricing";
import { TodayAppointmentsWidget } from "@/components/dashboard/TodayAppointmentsWidget";
import { NewMessagesTriageWidget } from "@/components/dashboard/NewMessagesTriageWidget";
import { RecentActivityWidget } from "@/components/dashboard/RecentActivityWidget";
import { QuickActionsPanel } from "@/components/dashboard/QuickActionsPanel";
import { FollowUpRemindersWidget } from "@/components/dashboard/FollowUpRemindersWidget";

// Dashboard component with real-time stats
const Dashboard = () => {
  const { user, effectiveRole, effectiveUserId, isImpersonating, isProviderAccount } = useAuth();
  const { isSubscribed, status, trialDaysRemaining } = useSubscription();
  const navigate = useNavigate();

  const { data: ordersCount, isLoading: ordersLoading } = useQuery({
    queryKey: ["dashboard-orders-count", effectiveRole, effectiveUserId],
    staleTime: 30000, // 30 seconds - dashboard stats refresh frequently
    queryFn: async () => {
      let count = 0;
      
      if (effectiveRole === "doctor") {
        const result: any = await (supabase as any)
          .from("orders")
          .select("*", { count: "exact", head: true })
          .neq("status", "cancelled")
          .neq("payment_status", "payment_failed")
          .eq("doctor_id", effectiveUserId);
        count = result.count || 0;
      } else if (effectiveRole === "provider" as any) {
        // Count distinct orders that have at least one order_line by this provider
        // and exclude failed payments
        const { data: providerData } = await supabase
          .from("providers")
          .select("id")
          .eq("user_id", effectiveUserId)
          .single();
        
        if (providerData) {
          const { data: providerOrderLines } = await supabase
            .from("order_lines")
            .select(`
              order_id,
              orders!inner(payment_status, status)
            `)
            .eq("provider_id", providerData.id)
            .neq("orders.payment_status", "payment_failed")
            .neq("orders.status", "cancelled");
          
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
          // and exclude failed payments
          const { data: orderLines } = await supabase
            .from("order_lines")
            .select(`
              order_id,
              orders!inner(payment_status, status)
            `)
            .eq("assigned_pharmacy_id", pharmacyData.id)
            .neq("orders.payment_status", "payment_failed")
            .neq("orders.status", "cancelled");
          
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
          .neq("status", "cancelled")
          .neq("payment_status", "payment_failed");
        count = result.count || 0;
      }
      
      return count;
    },
  });

  const { data: productsCount, isLoading: productsLoading } = useQuery({
    queryKey: ["dashboard-products-count", effectiveRole, effectiveUserId],
    staleTime: 30000, // 30 seconds
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

          logger.info('Dashboard visible products', logger.sanitize({ effectiveUserId, effectiveRole, isImpersonating, count: visibleProducts?.length || 0 }));
          
          if (error) {
            logger.error('Visibility RPC error', error, logger.sanitize({ operation: 'get_visible_products' }));
            return 0;
          }
          
          return visibleProducts?.length || 0;
        } catch (error) {
          logger.error('Error checking product visibility', error instanceof Error ? error : new Error(String(error)), logger.sanitize({ operation: 'product_visibility_check' }));
          return 0;
        }
      }
    },
  });

  const { data: pendingOrdersCount, isLoading: pendingOrdersLoading } = useQuery({
    queryKey: ["dashboard-pending-orders-count", effectiveRole, effectiveUserId],
    staleTime: 30000, // 30 seconds
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
          orders!inner(status, payment_status)
        `)
        .eq("assigned_pharmacy_id", pharmacyData.id)
        .neq("orders.payment_status", "payment_failed")
        .eq("orders.status", "pending");
      
      // Get unique order IDs (one order can have multiple lines)
      const uniqueOrderIds = [...new Set(orderLines?.map(ol => ol.order_id) || [])];
      return uniqueOrderIds.length;
    },
    enabled: effectiveRole === "pharmacy",
  });

  const { data: usersCount, isLoading: usersLoading } = useQuery({
    queryKey: ["dashboard-users-count"],
    staleTime: 30000, // 30 seconds
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
    staleTime: 30000, // 30 seconds
    queryFn: async () => {
      let data: any = null;
      
      if (effectiveRole === "doctor") {
        const result: any = await (supabase as any)
          .from("orders")
          .select("total_amount")
          .neq("status", "cancelled")
          .neq("payment_status", "payment_failed")
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
              orders!inner(status, payment_status)
            `)
            .eq("provider_id", providerData.id)
            .neq("orders.payment_status", "payment_failed")
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
              orders!inner(status, payment_status)
            `)
            .eq("assigned_pharmacy_id", pharmacyData.id)
            .neq("orders.payment_status", "payment_failed")
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
          .neq("payment_status", "payment_failed")
          .eq("status", "pending");
        data = result.data;
      }
      
      const total = data?.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0) || 0;
      return total;
    },
  });

  const { data: collectedRevenue, isLoading: collectedRevenueLoading } = useQuery({
    queryKey: ["dashboard-collected-revenue", effectiveRole, effectiveUserId],
    staleTime: 30000, // 30 seconds
    queryFn: async () => {
      let data: any = null;
      
      if (effectiveRole === "doctor") {
        const result: any = await (supabase as any)
          .from("orders")
          .select("total_amount")
          .neq("status", "cancelled")
          .neq("payment_status", "payment_failed")
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
              orders!inner(status, payment_status)
            `)
            .eq("provider_id", providerData.id)
            .neq("orders.payment_status", "payment_failed")
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
              orders!inner(status, payment_status)
            `)
            .eq("assigned_pharmacy_id", pharmacyData.id)
            .neq("orders.payment_status", "payment_failed")
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
          .neq("payment_status", "payment_failed")
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
      title: effectiveRole === "doctor" ? "Total Paid" : "Pending Revenue",
      value: pendingRevenueLoading ? "..." : `$${pendingRevenue?.toFixed(2) || "0.00"}`,
      icon: DollarSign,
      description: effectiveRole === "doctor" ? "Total amount paid by practice" : (effectiveRole as any) === "provider" ? "Your pending revenue" : "Pending orders revenue",
      isLoading: pendingRevenueLoading,
      hidden: true, // Hidden for ALL practices per user request
    },
    {
      title: "Collected Revenue",
      value: collectedRevenueLoading ? "..." : `$${collectedRevenue?.toFixed(2) || "0.00"}`,
      icon: DollarSign,
      description: effectiveRole === "doctor" ? "Practice collected revenue" : (effectiveRole as any) === "provider" ? "Your collected revenue" : "Completed orders revenue",
      isLoading: collectedRevenueLoading,
      hidden: effectiveRole === "pharmacy" || effectiveRole === "provider" || effectiveRole === "doctor",
    },
  ].filter(stat => !stat.hidden);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gold-text-gradient">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Welcome back, {user?.email}
        </p>
        {status === 'trial' && trialDaysRemaining !== null && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Trial: {trialDaysRemaining} days remaining
            </span>
          </div>
        )}
      </div>

      {!isSubscribed && effectiveRole === 'doctor' && !isProviderAccount && (
        <Card className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="rounded-full bg-primary/20 p-4 shrink-0">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Unlock VitaLuxePro Features</h2>
              <p className="text-muted-foreground">
                Get access to patient appointments, secure messaging, digital EMR, AI-assisted triage, and more with a {TRIAL_DESCRIPTION}.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                {[
                  "Patient Appointment Booking",
                  "Secure Patient Messaging",
                  "Digital EMR & Medical Vault",
                  "AI-Assisted Triage System",
                  "Practice Calendar Management",
                  "Advanced Patient Portal"
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Lock className="h-4 w-4 text-primary shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button 
              onClick={() => navigate("/subscribe-to-vitaluxepro")}
              size="lg"
              className="bg-primary hover:bg-primary/90 shrink-0"
            >
              Start Free Trial
            </Button>
          </div>
        </Card>
      )}

      {/* Stats cards - Always visible for all users */}
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

      {/* V2 Widgets - Only for subscribed doctor/provider */}
      {isSubscribed && (effectiveRole === 'doctor' || (effectiveRole as any) === 'provider') && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <TodayAppointmentsWidget />
            <NewMessagesTriageWidget />
            <FollowUpRemindersWidget />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <RecentActivityWidget />
            <QuickActionsPanel />
          </div>
        </>
      )}

      {!isSubscribed && (
        <Card className="p-6 bg-card border-border shadow-gold">
        <h2 className="text-2xl font-semibold mb-4 text-primary">
          Recent Activity
        </h2>
        <p className="text-muted-foreground">
          No recent activity to display.
        </p>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
