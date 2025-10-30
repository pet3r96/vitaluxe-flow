import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, FileText, Calendar, Package, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

export function RecentActivityWidget({ className }: { className?: string }) {
  const { effectivePracticeId } = useAuth();
  const { data: activities, isLoading } = useQuery({
    queryKey: ["recent-activity", effectivePracticeId],
    enabled: !!effectivePracticeId,
    queryFn: async () => {
      if (!effectivePracticeId) return [] as any[];
      // Get recent orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, updated_at")
        .order("updated_at", { ascending: false })
        .limit(5) as any;
      
      // Get recent appointments
      const { data: appointments } = await supabase
        .from("patient_appointments")
        .select("id, status, updated_at, practice_id, patient_accounts(id, first_name, last_name)")
        .eq("practice_id", effectivePracticeId)
        .order("updated_at", { ascending: false })
        .limit(5) as any;
      
      // Get recent documents (if accessible)
      const { data: documents } = await supabase
        .from("provider_documents" as any)
        .select("id, document_name, status, updated_at, practice_id")
        .eq("practice_id", effectivePracticeId)
        .order("updated_at", { ascending: false })
        .limit(5) as any;

      // Combine and sort all activities
      const combined: any[] = [];

      orders?.forEach((order) => {
        combined.push({
          type: "order",
          icon: Package,
          description: `Order status changed to ${order.status}`,
          time: order.updated_at,
        });
      });

      appointments?.forEach((appt) => {
        const patientName = appt.patient_accounts 
          ? `${appt.patient_accounts.first_name || ''} ${appt.patient_accounts.last_name || ''}`.trim() || 'Patient'
          : 'Patient';
        combined.push({
          type: "appointment",
          icon: Calendar,
          description: `Appointment ${appt.status} - ${patientName}`,
          time: appt.updated_at,
        });
      });

      documents?.forEach((doc) => {
        combined.push({
          type: "document",
          icon: FileText,
          description: `Document "${doc.document_name}" ${doc.status}`,
          time: doc.updated_at,
        });
      });

      // Sort by time and take top 5
      return combined
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 5);
    },
    refetchInterval: 60000,
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : activities && activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity, index) => {
              const Icon = activity.icon;
              return (
                <div key={index} className="flex items-start gap-3 text-sm">
                  <Icon className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}