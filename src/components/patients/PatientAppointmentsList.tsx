import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, MapPin, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useEffect } from "react";
import { realtimeManager } from "@/lib/realtimeManager";
import { useQueryClient } from "@tanstack/react-query";

interface PatientAppointmentsListProps {
  patientId: string;
  practiceId: string;
}

export const PatientAppointmentsList = ({ patientId, practiceId }: PatientAppointmentsListProps) => {
  const queryClient = useQueryClient();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['patient-appointments', patientId, practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_appointments')
        .select('*')
        .eq('patient_id', patientId)
        .eq('practice_id', practiceId)
        .order('start_time', { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 10000, // 10 seconds
  });

  // Realtime subscription for immediate updates
  useEffect(() => {
    realtimeManager.subscribe('patient_appointments', () => {
      queryClient.invalidateQueries({ queryKey: ['patient-appointments', patientId] });
    });
  }, [patientId, queryClient]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
      scheduled: { variant: "default", className: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
      completed: { variant: "secondary", className: "bg-green-500/10 text-green-500 border-green-500/30" },
      cancelled: { variant: "destructive", className: "bg-red-500/10 text-red-500 border-red-500/30" },
      no_show: { variant: "outline", className: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
    };

    const config = variants[status] || variants.scheduled;
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!appointments || appointments.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No appointments found for this patient</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {appointments.map((appointment) => (
        <Card key={appointment.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base sm:text-lg">
                  {format(new Date(appointment.start_time), 'MMM dd, yyyy')}
                </CardTitle>
              </div>
              {getStatusBadge(appointment.status)}
            </div>
            {appointment.appointment_type && (
              <CardDescription className="flex items-center gap-2 mt-2">
                <FileText className="h-3 w-3" />
                {appointment.appointment_type}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>
                  {format(new Date(appointment.start_time), 'h:mm a')} - {format(new Date(appointment.end_time), 'h:mm a')}
                </span>
              </div>

              {appointment.visit_type && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{appointment.visit_type}</span>
                </div>
              )}
            </div>

            {appointment.reason_for_visit && (
              <div className="pt-3 border-t">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Reason:</span> {appointment.reason_for_visit}
                </p>
              </div>
            )}

            {appointment.notes && (
              <div className="pt-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Notes:</span> {appointment.notes}
                </p>
              </div>
            )}

            {appointment.service_description && (
              <div className="pt-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Service:</span> {appointment.service_description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
