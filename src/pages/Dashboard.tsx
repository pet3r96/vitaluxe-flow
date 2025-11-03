import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Card } from "@/components/ui/card";
import { Package, ShoppingCart, Users, DollarSign, Clock, Sparkles, Lock } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { PRO_MONTHLY_PRICE_STR, TRIAL_DESCRIPTION } from "@/lib/pricing";
import { TodayAppointmentsWidget } from "@/components/dashboard/TodayAppointmentsWidget";
import { MessagesAndChatWidget } from "@/components/dashboard/MessagesAndChatWidget";
import { RecentActivityWidget } from "@/components/dashboard/RecentActivityWidget";
import { QuickActionsPanel } from "@/components/dashboard/QuickActionsPanel";
import { FollowUpRemindersWidget } from "@/components/dashboard/FollowUpRemindersWidget";
import { WaitingRoomWidget } from "@/components/dashboard/WaitingRoomWidget";
import { RequestedAppointmentsWidget } from "@/components/dashboard/RequestedAppointmentsWidget";
import { PatientQuickSearch } from "@/components/patients/PatientQuickSearch";
import { AnalyticsSection } from "@/components/dashboard/AnalyticsSection";
import { StatCardWithChart } from "@/components/dashboard/StatCardWithChart";
import { OrdersBreakdown } from "@/components/dashboard/OrdersBreakdown";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { TabbedAppointmentsWidget } from "@/components/dashboard/TabbedAppointmentsWidget";
import { TabbedCommunicationsWidget } from "@/components/dashboard/TabbedCommunicationsWidget";
import { DayViewCalendar } from "@/components/dashboard/DayViewCalendar";

// Dashboard component with real-time stats (desktop version)
const Dashboard = () => {
  const { user, effectiveRole, effectiveUserId, isImpersonating, isProviderAccount, effectivePracticeId } = useAuth();
  const { isSubscribed, status, trialDaysRemaining } = useSubscription();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch user profile for display name
  const { data: profileData } = useQuery({
    queryKey: ["dashboard-profile", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, full_name")
        .eq("id", effectiveUserId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

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
      } else if (effectiveRole === "staff") {
        // Get user's practice via providers table
        const { data: staffProvider } = await supabase
          .from("providers")
          .select("practice_id")
          .eq("user_id", effectiveUserId)
          .maybeSingle();
        
        if (staffProvider?.practice_id) {
          // Get all provider IDs in this practice
          const { data: practiceProviders } = await supabase
            .from("providers")
            .select("id")
            .eq("practice_id", staffProvider.practice_id);
          
          const providerIds = practiceProviders?.map(p => p.id) || [];
          
          if (providerIds.length > 0) {
            // Count orders with order_lines from these providers
            const { data: orderLines } = await supabase
              .from("order_lines")
              .select(`
                order_id,
                orders!inner(payment_status, status)
              `)
              .in("provider_id", providerIds)
              .neq("orders.payment_status", "payment_failed")
              .neq("orders.status", "cancelled");
            
            const uniqueOrderIds = [...new Set(orderLines?.map(ol => ol.order_id) || [])];
            count = uniqueOrderIds.length;
          }
        }
      } else if (effectiveRole === "admin") {
        // Admin can see all orders
        const result: any = await (supabase as any)
          .from("orders")
          .select("*", { count: "exact", head: true })
          .neq("status", "cancelled")
          .neq("payment_status", "payment_failed");
        count = result.count || 0;
      } else {
        // Default for unknown roles: show 0
        count = 0;
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
          .eq("payment_status", "paid");
        data = result.data;
      } else if (effectiveRole === "provider" as any) {
        // Get provider id first
        const { data: providerData } = await supabase
          .from("providers")
          .select("id")
          .eq("user_id", effectiveUserId)
          .single();
        
        if (providerData) {
          // Sum order line prices where provider prescribed and order is paid
          const { data: orderLines } = await supabase
            .from("order_lines")
            .select(`
              price,
              quantity,
              orders!inner(status, payment_status)
            `)
            .eq("provider_id", providerData.id)
            .neq("orders.payment_status", "payment_failed")
            .neq("orders.status", "cancelled")
            .eq("orders.payment_status", "paid");
          
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
          // Sum order line prices where pharmacy is assigned and order is paid
          const { data: orderLines } = await supabase
            .from("order_lines")
            .select(`
              price,
              quantity,
              orders!inner(status, payment_status)
            `)
            .eq("assigned_pharmacy_id", pharmacyData.id)
            .neq("orders.payment_status", "payment_failed")
            .neq("orders.status", "cancelled")
            .eq("orders.payment_status", "paid");
          
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
          .eq("payment_status", "paid");
        data = result.data;
      }
      
      const total = data?.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0) || 0;
      return total;
    },
  });

  // Real-time subscriptions for instant dashboard updates
  useEffect(() => {
    if (!effectiveUserId) return;

    const channels: any[] = [];

    // Subscribe to orders changes
    const ordersChannel = supabase
      .channel('dashboard-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ["dashboard-orders-count"],
            refetchType: 'active'
          });
          queryClient.invalidateQueries({ 
            queryKey: ["dashboard-pending-orders-count"],
            refetchType: 'active'
          });
          queryClient.invalidateQueries({ 
            queryKey: ["dashboard-pending-revenue"],
            refetchType: 'active'
          });
          queryClient.invalidateQueries({ 
            queryKey: ["dashboard-collected-revenue"],
            refetchType: 'active'
          });
        }
      )
      .subscribe();
    channels.push(ordersChannel);

    // Subscribe to order_lines changes (affects pharmacy/provider counts)
    const orderLinesChannel = supabase
      .channel('dashboard-order-lines-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_lines' },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ["dashboard-orders-count"],
            refetchType: 'active'
          });
          queryClient.invalidateQueries({ 
            queryKey: ["dashboard-pending-revenue"],
            refetchType: 'active'
          });
          queryClient.invalidateQueries({ 
            queryKey: ["dashboard-collected-revenue"],
            refetchType: 'active'
          });
        }
      )
      .subscribe();
    channels.push(orderLinesChannel);

    // Subscribe to products changes
    const productsChannel = supabase
      .channel('dashboard-products-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ["dashboard-products-count"],
            refetchType: 'active'
          });
        }
      )
      .subscribe();
    channels.push(productsChannel);

    // Subscribe to profiles changes (for admin user count)
    if (effectiveRole === 'admin') {
      const profilesChannel = supabase
        .channel('dashboard-profiles-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          () => {
            queryClient.invalidateQueries({ 
              queryKey: ["dashboard-users-count"],
              refetchType: 'active'
            });
          }
        )
        .subscribe();
      channels.push(profilesChannel);
    }

    // Subscribe to patient check-ins for practice users
    if (effectivePracticeId && (effectiveRole === 'doctor' || effectiveRole === 'staff' || effectiveRole === 'provider')) {
      const appointmentsChannel = supabase
        .channel('dashboard-appointments-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'patient_appointments',
            filter: `practice_id=eq.${effectivePracticeId}`
          },
          () => {
            queryClient.invalidateQueries({ 
              queryKey: ["waiting-room-dashboard"],
              refetchType: 'active'
            });
          }
        )
        .subscribe();
      channels.push(appointmentsChannel);
    }

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [effectiveUserId, effectiveRole, effectivePracticeId, queryClient]);

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
      description: effectiveRole === "doctor" ? "Practice collected revenue" : (effectiveRole as any) === "provider" ? "Your collected revenue" : "Paid orders revenue",
      isLoading: collectedRevenueLoading,
      hidden: effectiveRole === "pharmacy" || effectiveRole === "provider" || effectiveRole === "doctor" || effectiveRole === "staff",
    },
  ].filter(stat => !stat.hidden);

  // Display name with fallback chain
  const displayName = profileData?.full_name || profileData?.name || user?.email;

  return (
    <div className="patient-container">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gold-text-gradient">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Welcome back, {displayName}
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
        <div className="patient-card p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="rounded-full bg-primary/20 p-4 shrink-0">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Unlock VitaLuxePro Features</h2>
              <p className="text-muted-foreground">
                Get access to patient appointments, secure messaging, digital EMR, and more with a {TRIAL_DESCRIPTION}.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                {[
                  "Patient Appointment Booking",
                  "Secure Patient Messaging",
                  "Digital EMR & Medical Vault",
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
        </div>
      )}

      {/* Dashboard Layout for Practice Users - Providers don't need subscription */}
      {((effectiveRole as any) === 'provider' || (isSubscribed && (effectiveRole === 'doctor' || effectiveRole === 'staff'))) && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Main Content Area - 3/4 width */}
          <div className="lg:col-span-3 space-y-4 lg:space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
              <StatCardWithChart
                title="Total Orders"
                metricKey="orders"
                icon={ShoppingCart}
                description={effectiveRole === "doctor" ? "Your practice orders" : (effectiveRole as any) === "provider" ? "Your orders" : "All orders"}
                currentValue={ordersLoading ? "..." : ordersCount?.toString() || "0"}
                role={effectiveRole}
                userId={effectiveUserId}
              />
              <StatCardWithChart
                title="Products"
                metricKey="products"
                icon={Package}
                description="Active products"
                currentValue={productsLoading ? "..." : productsCount?.toString() || "0"}
                role={effectiveRole}
                userId={effectiveUserId}
              />
            </div>

            {/* Widgets Grid - Show for subscribed doctors/staff AND providers */}
            {(isSubscribed && (effectiveRole === 'doctor' || effectiveRole === 'staff')) || (effectiveRole as any) === 'provider' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                <TabbedAppointmentsWidget />
                <WaitingRoomWidget />
                <TabbedCommunicationsWidget />
                <RecentActivityWidget />
              </div>
            ) : null}
          </div>

          {/* Right Sidebar - Search & Quick Actions - Show for subscribed doctors/staff AND providers */}
          {((isSubscribed && (effectiveRole === 'doctor' || effectiveRole === 'staff')) || (effectiveRole as any) === 'provider') && (
            <div className="lg:col-span-1 flex flex-col gap-4 lg:gap-6 h-full min-h-0">
              <div className="shrink-0">
                <PatientQuickSearch />
              </div>
              <div className="shrink-0">
                <QuickActionsPanel />
              </div>
              <DayViewCalendar />
            </div>
          )}
        </div>
      )}

      {/* Stats cards for other roles */}
      {(effectiveRole === 'pharmacy' || effectiveRole === 'admin') && (
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 flex-1 min-w-0">
            <StatCardWithChart
              title="Total Orders"
              metricKey="orders"
              icon={ShoppingCart}
              description="All orders"
              currentValue={ordersLoading ? "..." : ordersCount?.toString() || "0"}
              role={effectiveRole}
              userId={effectiveUserId}
            />
            <StatCardWithChart
              title="Products"
              metricKey="products"
              icon={Package}
              description="Active products"
              currentValue={productsLoading ? "..." : productsCount?.toString() || "0"}
              role={effectiveRole}
              userId={effectiveUserId}
            />
            {effectiveRole === "pharmacy" && (
              <StatCardWithChart
                title="Pending Orders"
                metricKey="pending_orders"
                icon={Clock}
                description="Orders awaiting fulfillment"
                currentValue={pendingOrdersLoading ? "..." : pendingOrdersCount?.toString() || "0"}
                role={effectiveRole}
                userId={effectiveUserId}
              />
            )}
            {effectiveRole === "admin" && (
              <>
                <StatCardWithChart
                  title="Users"
                  metricKey="users"
                  icon={Users}
                  description="Active accounts"
                  currentValue={usersLoading ? "..." : usersCount?.toString() || "0"}
                  role={effectiveRole}
                  userId={effectiveUserId}
                />
                <StatCardWithChart
                  title="Collected Revenue"
                  metricKey="revenue"
                  icon={DollarSign}
                  description="Paid orders revenue"
                  currentValue={collectedRevenueLoading ? "..." : `$${collectedRevenue?.toFixed(2) || "0.00"}`}
                  role={effectiveRole}
                  userId={effectiveUserId}
                  valueFormatter={(v) => `$${v.toFixed(2)}`}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* For pharmacy: show Orders by Status next to stats + Recent Activity */}
      {isSubscribed && effectiveRole === 'pharmacy' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 items-stretch">
            <div className="lg:col-span-1">
              <OrdersBreakdown />
            </div>
            <div className="lg:col-span-2">
              <RecentActivityWidget className="h-full" />
            </div>
          </div>
        </>
      )}

      {/* For admin: Analytics (includes Revenue + Orders) and Recent Activity */}
      {effectiveRole === 'admin' && (
        <>
          <AnalyticsSection />
          <RecentActivityWidget className="mt-4 lg:mt-6" />
        </>
      )}

      {!isSubscribed && effectiveRole !== 'pharmacy' && effectiveRole !== 'admin' && (effectiveRole as any) !== 'provider' && (
        <>
          {/* Stats cards with charts for non-subscribed doctors/staff - Full width */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-6">
            <StatCardWithChart
              title="Total Orders"
              metricKey="orders"
              icon={ShoppingCart}
              description="Your practice orders"
              currentValue={ordersLoading ? "..." : ordersCount?.toString() || "0"}
              role={effectiveRole}
              userId={effectiveUserId}
            />
            <StatCardWithChart
              title="Products"
              metricKey="products"
              icon={Package}
              description="Active products"
              currentValue={productsLoading ? "..." : productsCount?.toString() || "0"}
              role={effectiveRole}
              userId={effectiveUserId}
            />
          </div>
          
          {/* Recent Activity Widget - Full width */}
          <RecentActivityWidget />
        </>
      )}
    </div>
  );
};

export default Dashboard;
