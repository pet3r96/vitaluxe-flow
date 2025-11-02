import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInMinutes } from "date-fns";
import { useEffect, useCallback, useMemo } from "react";
import { PatientQuickAccessButton } from "@/components/patients/PatientQuickAccessButton";

export function WaitingRoomWidget() {
  const navigate = useNavigate();
  const { effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();

  const { data: waitingPatients, isLoading } = useQuery({
    queryKey: ["waiting-room-dashboard", effectivePracticeId],
    queryFn: async () => {
      if (!effectivePracticeId) return [];

      const { data, error } = await supabase
        .from("patient_appointments")
        .select(`
          id,
          checked_in_at,
          patient:patient_accounts(id, first_name, last_name)
        `)
        .eq("practice_id", effectivePracticeId)
        .eq("status", "checked_in")
        .order("checked_in_at", { ascending: true })
        .limit(5);

      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 30000, // 30 seconds
    enabled: !!effectivePracticeId,
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!effectivePracticeId) return;

    const channel = supabase
      .channel('waiting-room-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_appointments',
          filter: `practice_id=eq.${effectivePracticeId}`
        },
        () => {
          // Invalidate the specific query when patient_appointments change
          queryClient.invalidateQueries({ 
            queryKey: ["waiting-room-dashboard", effectivePracticeId],
            refetchType: 'active'
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectivePracticeId, queryClient]);

  const getWaitTimeColor = useCallback((minutes: number) => {
    if (minutes < 5) return "text-success";
    if (minutes <= 10) return "text-warning";
    return "text-destructive";
  }, []);

  const calculateWaitTime = useCallback((checkedInAt: string) => {
    const minutes = differenceInMinutes(new Date(), new Date(checkedInAt));
    return minutes;
  }, []);

  const handleCardClick = useCallback(() => {
    navigate("/practice-calendar");
  }, [navigate]);

  // Memoize top 3 patients to prevent recalculation
  const displayedPatients = useMemo(() => {
    return waitingPatients?.slice(0, 3) || [];
  }, [waitingPatients]);

  return (
    <Card 
      variant="modern"
      className="cursor-pointer hover:shadow-lg transition-all duration-200"
      onClick={handleCardClick}
    >
      <CardHeader className="relative bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Clock className="h-5 w-5" />
            Waiting Room
          </CardTitle>
          {!isLoading && waitingPatients && waitingPatients.length > 0 && (
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {waitingPatients.length}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : waitingPatients && waitingPatients.length > 0 ? (
          <div className="space-y-2">
            {displayedPatients.map((appointment) => {
              const waitMinutes = calculateWaitTime(appointment.checked_in_at);
              return (
                <div
                  key={appointment.id}
                  className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-amber-50/50 to-amber-100/30 dark:from-amber-950/20 dark:to-amber-900/10 hover:scale-[1.01] transition-transform duration-200"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-semibold truncate flex-1">
                        {appointment.patient
                          ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
                          : "Unknown Patient"}
                      </div>
                      {appointment.patient?.id && (
                        <PatientQuickAccessButton
                          patientId={appointment.patient.id}
                          patientName={`${appointment.patient.first_name} ${appointment.patient.last_name}`}
                          variant="icon"
                          size="sm"
                        />
                      )}
                    </div>
                    <div className={`text-sm font-medium flex items-center gap-2 ${getWaitTimeColor(waitMinutes)}`}>
                      <Clock className="h-3.5 w-3.5" />
                      {waitMinutes} min{waitMinutes !== 1 ? 's' : ''} waiting
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-16 w-16 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No patients waiting</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
