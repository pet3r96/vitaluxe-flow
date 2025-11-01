import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, AlertCircle, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, parse } from "date-fns";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppointmentRequestReviewDialog } from "@/components/calendar/AppointmentRequestReviewDialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface RequestedAppointment {
  id: string;
  start_time: string;
  reason_for_visit: string;
  requested_date: string;
  requested_time: string;
  reschedule_requested_at: string | null;
  reschedule_reason: string | null;
  patient_id?: string;
  patient_accounts: {
    id?: string;
    profiles: {
      full_name: string;
      name: string;
    };
  };
  providers: {
    profiles: {
      full_name: string;
      name: string;
    };
  } | null;
}

export const RequestedAppointmentsWidget = ({ className }: { className?: string }) => {
  const [selectedAppointment, setSelectedAppointment] = useState<RequestedAppointment | null>(null);
  const { effectivePracticeId } = useAuth();
  const navigate = useNavigate();

  const { data: requestedAppointments = [], refetch } = useQuery({
    queryKey: ["requested-appointments", effectivePracticeId],
    enabled: !!effectivePracticeId,
    staleTime: 30 * 1000, // 30 seconds instead of default 5 minutes for faster updates
    queryFn: async () => {
      if (!effectivePracticeId) return [] as RequestedAppointment[];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('patient_appointments')
        .select(`
          id,
          start_time,
          reason_for_visit,
          requested_date,
          requested_time,
          reschedule_requested_at,
          reschedule_reason,
          patient_accounts(
            profiles(
              full_name,
              name
            )
          ),
          providers(
            profiles!providers_user_id_fkey(
              full_name,
              name
            )
          )
        `)
        .eq('practice_id', effectivePracticeId as string)
        .eq('confirmation_type', 'pending')
        .eq('status', 'pending')
        .order('start_time', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data as RequestedAppointment[];
    },
  });

  // Real-time subscription for instant updates (replaces 30-second polling)
  useEffect(() => {
    if (!effectivePracticeId) return;
    
    const channel = supabase
      .channel('requested-appointments-realtime')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'patient_appointments',
          filter: `practice_id=eq.${effectivePracticeId}`
        },
        (payload) => {
          console.log('📋 Appointment request changed:', payload.eventType);
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, effectivePracticeId]);

  return (
    <>
      <Card variant="modern" className={cn("overflow-hidden", className)}>
        <CardHeader className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <AlertCircle className="h-5 w-5" />
              Requested Appointments
            </CardTitle>
            {requestedAppointments.length > 0 && (
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {requestedAppointments.length}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">

          {requestedAppointments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-16 w-16 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No pending appointment requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requestedAppointments.map((appointment) => {
                const patientProfile = appointment?.patient_accounts?.profiles;
                const patientName = patientProfile?.full_name || patientProfile?.name || 'Unknown Patient';
                const isReschedule = !!appointment.reschedule_requested_at;
                const requestedAt = appointment.reschedule_requested_at || appointment.start_time;

                return (
                  <div
                    key={appointment.id}
                    className="p-4 rounded-lg bg-gradient-to-br from-orange-50/50 to-orange-100/30 dark:from-orange-950/20 dark:to-orange-900/10 hover:scale-[1.01] transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => setSelectedAppointment(appointment)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                          <p className="font-semibold text-sm truncate">{patientName}</p>
                          {isReschedule && (
                            <Badge variant="outline" className="text-xs">Reschedule</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(appointment.requested_date || appointment.start_time), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {appointment.requested_time 
                                ? format(parse(appointment.requested_time, 'HH:mm:ss', new Date()), 'h:mm a')
                                : format(new Date(appointment.start_time), 'h:mm a')}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mb-1">{appointment.reason_for_visit}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(requestedAt), { addSuffix: true })}
                        </p>
                      </button>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/patients/${appointment.patient_accounts?.id}`);
                          }}
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="hover:bg-orange-100 dark:hover:bg-orange-900/30"
                          onClick={() => setSelectedAppointment(appointment)}
                        >
                          Review
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAppointment && (
        <AppointmentRequestReviewDialog
          appointment={selectedAppointment}
          open={!!selectedAppointment}
          onOpenChange={(open) => !open && setSelectedAppointment(null)}
          onSuccess={() => {
            setSelectedAppointment(null);
            refetch();
          }}
        />
      )}
    </>
  );
};
