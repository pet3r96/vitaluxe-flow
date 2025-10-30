import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { AppointmentDetailsDialog } from "@/components/calendar/AppointmentDetailsDialog";
import { realtimeManager } from "@/lib/realtimeManager";

export function TodayAppointmentsWidget() {
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["today-appointments"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from("patient_appointments")
        .select(`
          *,
          patient_account:patient_accounts(id, first_name, last_name)
        `)
        .gte("start_time", today.toISOString())
        .lt("start_time", tomorrow.toISOString())
        .neq("status", "cancelled")
        .order("start_time", { ascending: true })
        .limit(5);

      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 0,
  });

  // Real-time subscription for instant updates using centralized manager
  useEffect(() => {
    realtimeManager.subscribe('patient_appointments', () => {
      queryClient.invalidateQueries({ queryKey: ["today-appointments"] });
    });
    
    // Cleanup handled by realtimeManager
  }, [queryClient]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success text-success-foreground";
      case "no_show": return "bg-destructive text-destructive-foreground";
      default: return "bg-primary text-primary-foreground";
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : appointments && appointments.length > 0 ? (
            <div className="space-y-3">
              {appointments.map((appointment) => (
                <Button
                  key={appointment.id}
                  variant="ghost"
                  className="w-full justify-start text-left h-auto p-3 hover:bg-accent"
                  onClick={() => setSelectedAppointment(appointment)}
                >
                  <div className="flex items-start gap-3 w-full">
                    <Clock className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {appointment.patient_account 
                          ? `${appointment.patient_account.first_name} ${appointment.patient_account.last_name}`
                          : "Unknown Patient"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(appointment.start_time), "h:mm a")}
                      </div>
                    </div>
                    <Badge className={getStatusColor(appointment.status)}>
                      {appointment.status}
                    </Badge>
                  </div>
                </Button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No appointments today</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAppointment && (
        <AppointmentDetailsDialog
          appointment={selectedAppointment}
          open={!!selectedAppointment}
          onOpenChange={(open) => !open && setSelectedAppointment(null)}
          providers={[]}
          rooms={[]}
        />
      )}
    </>
  );
}
