import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
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
      <Card className={cn("p-6 bg-card border-border shadow-gold", className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-semibold text-foreground">Requested Appointments</h2>
          </div>
          {requestedAppointments.length > 0 && (
            <Badge variant="destructive" className="bg-amber-500 hover:bg-amber-600">
              {requestedAppointments.length}
            </Badge>
          )}
        </div>

        {requestedAppointments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No pending appointment requests</p>
        ) : (
          <div className="space-y-3">
            {requestedAppointments.map((appointment) => {
              const patientProfile = appointment?.patient_accounts?.profiles;
              const patientName = patientProfile?.full_name || patientProfile?.name || 'Unknown Patient';
              const isReschedule = !!appointment.reschedule_requested_at;
              const requestedAt = appointment.reschedule_requested_at || appointment.start_time;

              return (
                <div
                  key={appointment.id}
                  className="p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => setSelectedAppointment(appointment)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <p className="font-medium text-sm truncate">{patientName}</p>
                        {isReschedule && (
                          <Badge variant="outline" className="text-xs">Reschedule</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
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
                      <p className="text-xs text-muted-foreground truncate">{appointment.reason_for_visit}</p>
                      <p className="text-xs text-muted-foreground mt-1">
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
                      <Button size="sm" variant="outline" onClick={() => setSelectedAppointment(appointment)}>
                        Review
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
