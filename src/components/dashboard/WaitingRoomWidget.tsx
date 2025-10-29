import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInMinutes } from "date-fns";
import { useEffect } from "react";

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
    staleTime: 0,
    enabled: !!effectivePracticeId,
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!effectivePracticeId) return;

    const channel = supabase
      .channel('waiting-room-widget-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_appointments',
          filter: `practice_id=eq.${effectivePracticeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["waiting-room-dashboard", effectivePracticeId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectivePracticeId, queryClient]);

  const getWaitTimeColor = (minutes: number) => {
    if (minutes < 5) return "text-success";
    if (minutes <= 10) return "text-warning";
    return "text-destructive";
  };

  const calculateWaitTime = (checkedInAt: string) => {
    const minutes = differenceInMinutes(new Date(), new Date(checkedInAt));
    return minutes;
  };

  return (
    <Card 
      className="cursor-pointer hover:bg-accent transition-colors"
      onClick={() => navigate("/practice-calendar")}
    >
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Waiting Room
        </CardTitle>
        {!isLoading && waitingPatients && waitingPatients.length > 0 && (
          <Badge className="absolute top-4 right-4 bg-orange-500 hover:bg-orange-600">
            {waitingPatients.length}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : waitingPatients && waitingPatients.length > 0 ? (
          <div className="space-y-3">
            {waitingPatients.slice(0, 3).map((appointment) => {
              const waitMinutes = calculateWaitTime(appointment.checked_in_at);
              return (
                <div
                  key={appointment.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <Clock className={`h-4 w-4 mt-1 ${getWaitTimeColor(waitMinutes)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {appointment.patient
                        ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
                        : "Unknown Patient"}
                    </div>
                    <div className={`text-sm ${getWaitTimeColor(waitMinutes)}`}>
                      {waitMinutes} min{waitMinutes !== 1 ? 's' : ''} waiting
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No patients waiting</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
