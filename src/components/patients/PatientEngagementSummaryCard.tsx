import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ClipboardList, CalendarClock, Bell, StickyNote } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PatientEngagementSummaryCardProps {
  patientAccountId: string;
  practiceId?: string;
  onNavigate?: (tab: string) => void;
}

export function PatientEngagementSummaryCard({
  patientAccountId,
  practiceId,
  onNavigate,
}: PatientEngagementSummaryCardProps) {
  const { data: counts, isLoading } = useQuery({
    queryKey: ["patient-overview-counts", patientAccountId, practiceId],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      
      const [notes, plans, upcoming, followups, docs] = await Promise.all([
        supabase
          .from("patient_notes")
          .select("id", { count: "exact", head: true })
          .eq("patient_account_id", patientAccountId)
          .eq("is_active", true),
        supabase
          .from("treatment_plans")
          .select("id", { count: "exact", head: true })
          .eq("patient_account_id", patientAccountId)
          .eq("is_active", true),
        practiceId
          ? supabase
              .from("patient_appointments")
              .select("id", { count: "exact", head: true })
              .eq("patient_id", patientAccountId)
              .eq("practice_id", practiceId)
              .gte("start_time", nowIso)
              .in("status", ["scheduled", "confirmed", "pending", "checked_in", "being_treated"])
          : Promise.resolve({ count: 0 }),
        supabase
          .from("patient_follow_ups")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", patientAccountId),
        supabase.rpc("get_patient_unified_documents", { p_patient_id: patientAccountId }),
      ]);

      return {
        notes: notes.count || 0,
        plans: plans.count || 0,
        upcoming: practiceId ? (upcoming.count || 0) : 0,
        followups: followups.count || 0,
        documents: Array.isArray(docs.data) ? docs.data.length : 0,
      };
    },
    enabled: !!patientAccountId,
    staleTime: 10000,
  });

  const tiles = [
    {
      icon: StickyNote,
      label: "Notes",
      count: counts?.notes || 0,
      tab: "notes",
      color: "text-blue-500",
    },
    {
      icon: ClipboardList,
      label: "Treatment Plans",
      count: counts?.plans || 0,
      tab: "treatment-plans",
      color: "text-purple-500",
    },
    {
      icon: CalendarClock,
      label: "Upcoming Appointments",
      count: counts?.upcoming || 0,
      tab: "appointments",
      color: "text-green-500",
    },
    {
      icon: Bell,
      label: "Follow-Ups",
      count: counts?.followups || 0,
      tab: "follow-ups",
      color: "text-orange-500",
    },
    {
      icon: FileText,
      label: "Documents",
      count: counts?.documents || 0,
      tab: "documents",
      color: "text-indigo-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {tiles.map((tile) => (
              <Button
                key={tile.tab}
                variant="outline"
                className="h-auto flex flex-col items-center justify-center p-4 hover:bg-accent/50 transition-colors"
                onClick={() => onNavigate?.(tile.tab)}
              >
                <tile.icon className={`h-8 w-8 mb-2 ${tile.color}`} />
                <div className="text-3xl font-bold mb-1">{tile.count}</div>
                <div className="text-xs text-muted-foreground text-center">
                  {tile.label}
                </div>
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
