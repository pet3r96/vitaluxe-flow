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
          const apptResponse = await (supabase as any)
            .from("patient_appointments")
            .select("*", { count: "exact", head: true })
            .eq("patient_id", effectiveUserId)
            .gte("appointment_date", today);
          results.appointments = apptResponse.count || 0;
          
          const msgResponse = await (supabase as any)
            .from("patient_messages")
            .select("*", { count: "exact", head: true })
            .eq("recipient_id", effectiveUserId)
            .eq("read", false);
          results.messages = msgResponse.count || 0;
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
      <MobilePageHeader 
        title="Dashboard" 
        subtitle={effectiveRole ? effectiveRole.charAt(0).toUpperCase() + effectiveRole.slice(1) : ""}
      />

      <div className="p-4 space-y-4">
        {/* Trial Banner for non-subscribed doctors */}
        {effectiveRole === "doctor" && !isSubscribed && trialDaysRemaining !== null && (
          <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-amber-100">
                  Trial: {trialDaysRemaining} days left
                </Badge>
                <Button
                  size="sm"
                  onClick={() => navigate("/my-subscription")}
                  className="ml-auto"
                >
                  Upgrade
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats Grid - simplified for mobile */}
        <div className="grid grid-cols-2 gap-3">
          {statsLoading ? (
            <>
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-12 w-full" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              {stats?.orders !== undefined && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-1">
                      <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                      <div className="text-2xl font-bold">{stats.orders}</div>
                      <div className="text-xs text-muted-foreground">Orders</div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {stats?.appointments !== undefined && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-1">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div className="text-2xl font-bold">{stats.appointments}</div>
                      <div className="text-xs text-muted-foreground">Upcoming</div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {stats?.messages !== undefined && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-1">
                      <MessageSquare className="h-5 w-5 text-muted-foreground" />
                      <div className="text-2xl font-bold">{stats.messages}</div>
                      <div className="text-xs text-muted-foreground">Unread</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2">
            {quickActions.map((action, idx) => (
              <Button
                key={idx}
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={action.onClick}
              >
                <action.icon className="h-5 w-5 mr-2" />
                {action.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity placeholder */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
