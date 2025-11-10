import * as Sentry from "@sentry/react";
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

const ErrorButton = () => (
  <Button
    variant="destructive"
    onClick={() => {
      const testError = new Error("This is your first error!");
      Sentry.captureException(testError);
      throw testError;
    }}
  >
    Break the world
  </Button>
);

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

  // Batched dashboard stats - single query replaces 6 separate queries
  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats-batched", effectiveRole, effectiveUserId, isImpersonating],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-dashboard-stats', {
        body: { role: effectiveRole, isImpersonating, effectiveUserId }
      });
      
      if (error) throw error;
      return data.data;
    },
    staleTime: 30000, // 30 seconds - faster refresh for real-time feel
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: false, // Don't refetch if cache is fresh
    refetchOnWindowFocus: false, // Don't refetch on tab switch
    placeholderData: (previousData) => previousData,
  });

  // Individual stats from batched response
  const ordersCount = dashboardStats?.ordersCount ?? 0;
  const productsCount = dashboardStats?.productsCount ?? 0;
  const pendingOrdersCount = dashboardStats?.pendingOrdersCount ?? 0;
  const usersCount = dashboardStats?.usersCount ?? 0;
  const pendingRevenue = dashboardStats?.pendingRevenue ?? 0;
  const collectedRevenue = dashboardStats?.collectedRevenue ?? 0;

  // Unified loading state
  const ordersLoading = statsLoading;
  const productsLoading = statsLoading;
  const pendingOrdersLoading = statsLoading;
  const usersLoading = statsLoading;
  const pendingRevenueLoading = statsLoading;
  const collectedRevenueLoading = statsLoading;

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
            queryKey: ["dashboard-stats-batched"],
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
            queryKey: ["dashboard-stats-batched"],
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
            queryKey: ["dashboard-stats-batched"],
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
              queryKey: ["dashboard-stats-batched"],
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
        <div className="mt-4">
          <ErrorButton />
        </div>
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
                currentValue={(ordersLoading || ordersCount === undefined) ? "..." : ordersCount.toString()}
                role={effectiveRole}
                userId={effectiveUserId}
              />
              <StatCardWithChart
                title="Products"
                metricKey="products"
                icon={Package}
                description="Active products"
                currentValue={(productsLoading || productsCount === undefined) ? "..." : productsCount.toString()}
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
              currentValue={(ordersLoading || ordersCount === undefined) ? "..." : ordersCount.toString()}
              role={effectiveRole}
              userId={effectiveUserId}
            />
            <StatCardWithChart
              title="Products"
              metricKey="products"
              icon={Package}
              description="Active products"
              currentValue={(productsLoading || productsCount === undefined) ? "..." : productsCount.toString()}
              role={effectiveRole}
              userId={effectiveUserId}
            />
            {effectiveRole === "pharmacy" && (
              <StatCardWithChart
                title="Pending Orders"
                metricKey="pending_orders"
                icon={Clock}
                description="Orders awaiting fulfillment"
                currentValue={(pendingOrdersLoading || pendingOrdersCount === undefined) ? "..." : pendingOrdersCount.toString()}
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
                  currentValue={(usersLoading || usersCount === undefined) ? "..." : usersCount.toString()}
                  role={effectiveRole}
                  userId={effectiveUserId}
                />
                <StatCardWithChart
                  title="Collected Revenue"
                  metricKey="revenue"
                  icon={DollarSign}
                  description="Paid orders revenue"
                  currentValue={(collectedRevenueLoading || collectedRevenue === undefined) ? "..." : `$${collectedRevenue.toFixed(2)}`}
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
              currentValue={(ordersLoading || ordersCount === undefined) ? "..." : ordersCount.toString()}
              role={effectiveRole}
              userId={effectiveUserId}
            />
            <StatCardWithChart
              title="Products"
              metricKey="products"
              icon={Package}
              description="Active products"
              currentValue={(productsLoading || productsCount === undefined) ? "..." : productsCount.toString()}
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
