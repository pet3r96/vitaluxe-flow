import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Check, Calendar as CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, isPast, isToday } from "date-fns";
import { toast } from "sonner";
import { useEffect, useCallback } from "react";
import { PatientQuickAccessButton } from "@/components/patients/PatientQuickAccessButton";

export function FollowUpRemindersWidget() {
  const queryClient = useQueryClient();

  const { data: followUps, isLoading } = useQuery({
    queryKey: ["follow-up-reminders"],
    queryFn: async () => {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const { data, error } = await supabase
        .from("patient_follow_ups" as any)
        .select(`
          *,
          patient:patient_accounts!patient_follow_ups_patient_id_fkey(id, first_name, last_name)
        `)
        .eq("status", "pending")
        .lte("follow_up_date", sevenDaysFromNow.toISOString().split("T")[0])
        .order("follow_up_date", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data as any[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    realtimeManager.subscribe('patient_follow_ups');

    return () => {
      // Manager handles cleanup
    };
  }, []);

  const markComplete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("patient_follow_ups" as any)
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-reminders"] });
      toast.success("Follow-up marked as complete");
    },
    onError: (error) => {
      toast.error("Failed to update follow-up");
      console.error(error);
    },
  });

  const getDateBadge = useCallback((dateString: string) => {
    const date = new Date(dateString);
    if (isPast(date) && !isToday(date)) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (isToday(date)) {
      return <Badge className="bg-orange-500">Due Today</Badge>;
    }
    return <Badge variant="secondary">Upcoming</Badge>;
  }, []);

  const handleFollowUpClick = useCallback((patientId: string) => {
    window.location.href = `/patients/${patientId}?tab=follow-ups`;
  }, []);

  const handleMarkComplete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    markComplete.mutate(id);
  }, [markComplete]);

  return (
    <Card variant="modern">
      <CardHeader className="bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/30 dark:to-rose-900/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <Bell className="h-5 w-5" />
            Patient Follow-Ups
          </CardTitle>
          {!isLoading && followUps && followUps.length > 0 && (
            <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">
              {followUps.length}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : followUps && followUps.length > 0 ? (
          <div className="space-y-2">
            {followUps.map((followUp) => (
              <div
                key={followUp.id}
                className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-rose-50/50 to-rose-100/30 dark:from-rose-950/20 dark:to-rose-900/10 hover:scale-[1.01] cursor-pointer transition-all duration-200"
                onClick={() => handleFollowUpClick(followUp.patient_id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-semibold truncate flex-1">
                      {followUp.patient 
                        ? `${followUp.patient.first_name} ${followUp.patient.last_name}`
                        : "Unknown Patient"}
                    </div>
                    {followUp.patient?.id && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <PatientQuickAccessButton
                          patientId={followUp.patient.id}
                          patientName={`${followUp.patient.first_name} ${followUp.patient.last_name}`}
                          variant="icon"
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground truncate mb-2">
                    {followUp.reason}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getDateBadge(followUp.follow_up_date)}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {format(new Date(followUp.follow_up_date), "MMM d")}
                    </span>
                    {followUp.priority && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        followUp.priority === 'urgent' ? 'bg-destructive text-destructive-foreground' :
                        followUp.priority === 'high' ? 'bg-orange-500 text-white' :
                        followUp.priority === 'medium' ? 'bg-yellow-500 text-white' :
                        'bg-blue-500 text-white'
                      }`}>
                        {followUp.priority}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="hover:bg-green-100 dark:hover:bg-green-900/30"
                  onClick={(e) => handleMarkComplete(e, followUp.id)}
                  disabled={markComplete.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="h-16 w-16 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No upcoming follow-ups</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}