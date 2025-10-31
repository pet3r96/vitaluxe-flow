import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, Users, DollarSign, Calendar, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MobilePageHeader } from "@/components/responsive/MobilePageHeader";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

/**
 * Mobile-optimized Dashboard
 * Simplified layout with stacked cards, quick actions, and essential metrics
 */
export default function DashboardMobile() {
  const { effectiveRole, effectiveUserId } = useAuth();
  const { isSubscribed, trialDaysRemaining } = useSubscription();
  const navigate = useNavigate();

  // Quick stats - cast supabase to bypass TypeScript deep type inference
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-mobile-stats", effectiveRole, effectiveUserId],
    staleTime: 60000,
    queryFn: async () => {
      const results: Record<string, number> = {};
      
      try {
        if (effectiveRole === "doctor" && effectiveUserId) {
          const response = await (supabase as any)
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("doctor_id", effectiveUserId);
          results.orders = response.count || 0;
        } else if (effectiveRole === "provider" && effectiveUserId) {
          const response = await (supabase as any)
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("provider_id", effectiveUserId);
          results.orders = response.count || 0;
        }
        
        if (effectiveRole === "patient" && effectiveUserId) {
          const today = new Date().toISOString();
          
          const { data: patientAccount } = await supabase
            .from("patient_accounts")
            .select("id")
            .eq("user_id", effectiveUserId)
            .single();
          
          if (patientAccount) {
            const apptResponse = await supabase
              .from("patient_appointments")
              .select("*", { count: "exact", head: true })
              .eq("patient_id", patientAccount.id)
              .gte("start_time", today)
              .in('status', ['scheduled', 'pending']);
            results.appointments = apptResponse.count || 0;
            
            // Use message_threads system
            const { data: threads } = await supabase
              .from("thread_participants")
              .select("thread_id")
              .eq("user_id", effectiveUserId);
            
            const threadIds = threads?.map(t => t.thread_id) || [];
            if (threadIds.length > 0) {
              const { data: messages } = await supabase
                .from("messages")
                .select("id, sender_id")
                .in("thread_id", threadIds)
                .neq("sender_id", effectiveUserId);
              results.messages = messages?.length || 0;
            }
          }
        }
      } catch (error) {
        console.error("Error fetching mobile dashboard stats:", error);
      }
      
      return results;
    },
  });

  // Quick actions based on role
  const getQuickActions = () => {
    const actions = [];
    
    if (effectiveRole === "doctor" || effectiveRole === "provider") {
      actions.push(
        { label: "New Order", icon: ShoppingCart, onClick: () => navigate("/products") },
        { label: "View Patients", icon: Users, onClick: () => navigate("/patients") },
        { label: "Messages", icon: MessageSquare, onClick: () => navigate("/messages") }
      );
    }
    
    if (effectiveRole === "patient") {
      actions.push(
        { label: "Book Appointment", icon: Calendar, onClick: () => navigate("/appointments") },
        { label: "View Documents", icon: Package, onClick: () => navigate("/documents") },
        { label: "Messages", icon: MessageSquare, onClick: () => navigate("/patient-messages") }
      );
    }
    
    return actions;
  };

  const quickActions = getQuickActions();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="text-center py-6 px-4 border-b border-border">
        <h1 className="text-2xl font-bold gold-text-gradient">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {effectiveRole ? effectiveRole.charAt(0).toUpperCase() + effectiveRole.slice(1) : ""}
        </p>
      </div>

      <div className="patient-container space-y-4">
        {/* Trial Banner for non-subscribed doctors */}
        {effectiveRole === "doctor" && !isSubscribed && trialDaysRemaining !== null && (
          <div className="patient-card bg-gradient-to-r from-primary/10 to-gold-light/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-amber-100">
                  Trial: {trialDaysRemaining} days left
                </Badge>
                <Button
                  size="sm"
                  onClick={() => navigate("/my-subscription")}
                  className="ml-auto touch-target-sm"
                >
                  Upgrade
                </Button>
              </div>
            </CardContent>
          </div>
        )}

        {/* Quick Stats Grid - simplified for mobile */}
        <div className="grid grid-cols-2 gap-3">
          {statsLoading ? (
            <>
              {[1, 2].map((i) => (
                <div key={i} className="patient-card">
                  <CardContent className="p-4">
                    <Skeleton className="h-12 w-full" />
                  </CardContent>
                </div>
              ))}
            </>
          ) : (
            <>
              {stats?.orders !== undefined && (
                <div className="patient-stat-card">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-1">
                      <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                      <div className="text-2xl font-bold">{stats.orders}</div>
                      <div className="text-xs text-muted-foreground">Orders</div>
                    </div>
                  </CardContent>
                </div>
              )}
              
              {stats?.appointments !== undefined && (
                <div className="patient-stat-card">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-1">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div className="text-2xl font-bold">{stats.appointments}</div>
                      <div className="text-xs text-muted-foreground">Upcoming</div>
                    </div>
                  </CardContent>
                </div>
              )}
              
              {stats?.messages !== undefined && (
                <div className="patient-stat-card">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-1">
                      <MessageSquare className="h-5 w-5 text-muted-foreground" />
                      <div className="text-2xl font-bold">{stats.messages}</div>
                      <div className="text-xs text-muted-foreground">Unread</div>
                    </div>
                  </CardContent>
                </div>
              )}
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="patient-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-center">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2">
            {quickActions.map((action, idx) => (
              <Button
                key={idx}
                variant="outline"
                className="justify-start h-auto py-3 touch-target"
                onClick={action.onClick}
              >
                <action.icon className="h-5 w-5 mr-2" />
                {action.label}
              </Button>
            ))}
          </CardContent>
        </div>

        {/* Recent Activity placeholder */}
        <div className="patient-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-center">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          </CardContent>
        </div>
      </div>
    </div>
  );
}
