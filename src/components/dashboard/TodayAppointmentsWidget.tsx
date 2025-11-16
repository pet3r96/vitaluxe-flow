import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo, useCallback } from "react";
import { AppointmentDetailsDialog } from "@/components/calendar/AppointmentDetailsDialog";
import { realtimeManager } from "@/lib/realtimeManager";
import { useAuth } from "@/contexts/AuthContext";
import { PatientQuickAccessButton } from "@/components/patients/PatientQuickAccessButton";

export function TodayAppointmentsWidget() {
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const queryClient = useQueryClient();
  const { effectivePracticeId, effectiveRole, effectiveUserId } = useAuth();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["today-appointments", effectivePracticeId],
    enabled: !!effectivePracticeId,
    queryFn: async () => {
      if (!effectivePracticeId) return [] as any[];
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
        .eq("practice_id", effectivePracticeId)
        .gte("start_time", today.toISOString())
        .lt("start_time", tomorrow.toISOString())
        .neq("status", "cancelled")
        .order("start_time", { ascending: true })
        .limit(5);

      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60000, // 1 minute
  });

  const { data: providers = [] } = useQuery<any[]>({
    queryKey: ["widget-providers", effectivePracticeId, effectiveRole, effectiveUserId],
    enabled: !!effectivePracticeId,
    queryFn: async (): Promise<any[]> => {
      // Single query with join for better performance (combines 2 sequential queries)
      const { data: providers, error } = await supabase
        .from("providers")
        .select(`
          id,
          user_id,
          active,
          practice_id,
          profiles:user_id(id, full_name, name, prescriber_name, email)
        `)
        .eq("practice_id", effectivePracticeId)
        .eq("active", true);

      if (error) throw error;
      const records = providers || [];

      // If provider account, restrict to themselves
      const filtered = effectiveRole === "provider"
        ? records.filter((p: any) => p.user_id === effectiveUserId)
        : records;

      if (filtered.length === 0) return [];

      // Transform to expected format with profile data already joined
      return filtered.map((p: any) => {
        const prof = p.profiles;
        
        // Priority: prescriber_name > full_name > name (if not email) > derive from email
        let display = "Provider";
        if (prof?.prescriber_name) {
          display = prof.prescriber_name;
        } else if (prof?.full_name) {
          display = prof.full_name;
        } else if (prof?.name && !prof.name.includes('@')) {
          display = prof.name;
        } else if (prof?.email) {
          const localPart = prof.email.split('@')[0];
          display = localPart.split(/[._-]/).map((word: string) => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
        }
        
        const parts = display.trim().split(" ");
        return {
          id: p.id,
          user_id: p.user_id,
          active: p.active,
          full_name: display,
          first_name: parts[0] || "",
          last_name: parts.slice(1).join(" ") || "",
        };
      });
    },
  });

  const { data: rooms = [] } = useQuery<any[]>({
    queryKey: ["widget-rooms", effectivePracticeId],
    enabled: !!effectivePracticeId,
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase
        .from("practice_rooms")
        .select("id, name, active, practice_id")
        .eq("practice_id", effectivePracticeId)
        .eq("active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  // Real-time subscription for instant updates using centralized manager
  useEffect(() => {
    realtimeManager.subscribe('patient_appointments', () => {
      queryClient.invalidateQueries({ queryKey: ["today-appointments", effectivePracticeId] });
    });
    
    // Cleanup handled by realtimeManager
  }, [queryClient, effectivePracticeId]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "completed": return "bg-success text-success-foreground";
      case "no_show": return "bg-destructive text-destructive-foreground";
      default: return "bg-primary text-primary-foreground";
    }
  }, []);

  const handleAppointmentClick = useCallback((appointment: any) => {
    setSelectedAppointment(appointment);
  }, []);

  return (
    <>
      <Card variant="modern">
        <CardHeader className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Calendar className="h-5 w-5" />
              Today's Appointments
            </CardTitle>
            {!isLoading && appointments && appointments.length > 0 && (
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {appointments.length}
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
          ) : appointments && appointments.length > 0 ? (
            <div className="space-y-2">
              {appointments.map((appointment) => (
                <Button
                  key={appointment.id}
                  variant="ghost"
                  className="w-full justify-start text-left h-auto p-4 hover:bg-accent/50 rounded-lg transition-all duration-200 hover:scale-[1.01]"
                  onClick={() => handleAppointmentClick(appointment)}
                >
                  <div className="flex items-start gap-3 w-full">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-semibold truncate flex-1 text-base">
                          {appointment.patient_account 
                            ? `${appointment.patient_account.first_name} ${appointment.patient_account.last_name}`
                            : "Unknown Patient"}
                        </div>
                        {appointment.patient_account?.id && (
                          <PatientQuickAccessButton
                            patientId={appointment.patient_account.id}
                            patientName={`${appointment.patient_account.first_name} ${appointment.patient_account.last_name}`}
                            variant="icon"
                            size="sm"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {format(new Date(appointment.start_time), "h:mm a")}
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(appointment.status)} font-medium`}>
                      {appointment.status}
                    </Badge>
                  </div>
                </Button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-16 w-16 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No appointments today</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAppointment && (
        <AppointmentDetailsDialog
          appointment={selectedAppointment}
          open={!!selectedAppointment}
          onOpenChange={(open) => !open && setSelectedAppointment(null)}
          providers={providers}
          rooms={rooms}
        />
      )}
    </>
  );
}
