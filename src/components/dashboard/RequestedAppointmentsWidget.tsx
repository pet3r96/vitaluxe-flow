import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import { AppointmentRequestReviewDialog } from "@/components/calendar/AppointmentRequestReviewDialog";
import { cn } from "@/lib/utils";

interface RequestedAppointment {
  id: string;
  start_time: string;
  reason_for_visit: string;
  requested_date: string;
  requested_time: string;
  reschedule_requested_at: string | null;
  reschedule_reason: string | null;
  patient_accounts: {
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

  const { data: requestedAppointments = [], refetch } = useQuery({
    queryKey: ["requested-appointments"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check for impersonation
      const { data: impersonationData } = await supabase.functions.invoke('get-active-impersonation');
      const effectiveUserId = impersonationData?.session?.impersonated_user_id || user.id;

      // Get practice ID from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', effectiveUserId)
        .single();

      if (!profile) throw new Error("Profile not found");

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
          patient_accounts!inner(
            profiles!inner(
              full_name,
              name
            )
          ),
          providers(
            profiles(
              full_name,
              name
            )
          )
        `)
        .eq('practice_id', profile.id)
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
    const channel = supabase
      .channel('requested-appointments-realtime')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'patient_appointments'
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
  }, [refetch]);

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
              const patientName = appointment.patient_accounts?.profiles?.full_name || 
                                 appointment.patient_accounts?.profiles?.name || 
                                 'Unknown Patient';
              const isReschedule = !!appointment.reschedule_requested_at;
              const requestedAt = appointment.reschedule_requested_at || appointment.start_time;

              return (
                <div
                  key={appointment.id}
                  className="p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedAppointment(appointment)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
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
                          <span>{appointment.requested_time || format(new Date(appointment.start_time), 'h:mm a')}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{appointment.reason_for_visit}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(requestedAt), { addSuffix: true })}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      Review
                    </Button>
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
