import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { AppointmentDetailsDialog } from "@/components/calendar/AppointmentDetailsDialog";
import { PatientQuickAccessButton } from "@/components/patients/PatientQuickAccessButton";
import { AppointmentRequestReviewDialog } from "@/components/calendar/AppointmentRequestReviewDialog";
import { formatDistanceToNow, parse } from "date-fns";
import { FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useCallback } from "react";
import { realtimeManager } from "@/lib/realtimeManager";

export function TabbedAppointmentsWidget() {
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const { effectivePracticeId, effectiveRole, effectiveUserId } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Today's Appointments Query
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
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
        .limit(10);

      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60000,
  });

  // Upcoming Appointments Query (Next 7 days, limit 3)
  const { data: upcomingAppointments, isLoading: upcomingLoading } = useQuery({
    queryKey: ["upcoming-appointments", effectivePracticeId],
    enabled: !!effectivePracticeId,
    queryFn: async () => {
      if (!effectivePracticeId) return [] as any[];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const nextWeek = new Date(tomorrow);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const { data, error } = await supabase
        .from("patient_appointments")
        .select(`
          *,
          patient_account:patient_accounts(id, first_name, last_name)
        `)
        .eq("practice_id", effectivePracticeId)
        .gte("start_time", tomorrow.toISOString())
        .lt("start_time", nextWeek.toISOString())
        .neq("status", "cancelled")
        .order("start_time", { ascending: true })
        .limit(3);

      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60000,
  });

  // Requested Appointments Query
  const { data: requestedAppointments = [], refetch: refetchRequested } = useQuery({
    queryKey: ["requested-appointments", effectivePracticeId],
    enabled: !!effectivePracticeId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!effectivePracticeId) return [] as any[];
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
          patient_id,
          patient_accounts(
            id,
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
        .limit(10);

      if (error) throw error;
      return data as any[];
    },
  });

  // Providers Query
  const { data: providers = [] } = useQuery<any[]>({
    queryKey: ["widget-providers", effectivePracticeId, effectiveRole, effectiveUserId],
    enabled: !!effectivePracticeId,
    queryFn: async (): Promise<any[]> => {
      const { data: providerRecords, error: provErr } = await supabase
        .from("providers")
        .select("id, user_id, active, practice_id")
        .eq("practice_id", effectivePracticeId)
        .eq("active", true);

      if (provErr) throw provErr;
      const records = providerRecords || [];

      const filtered = effectiveRole === "provider"
        ? records.filter((p: any) => p.user_id === effectiveUserId)
        : records;

      if (filtered.length === 0) return [];

      const userIds = filtered.map((p: any) => p.user_id);
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, name, prescriber_name, email")
        .in("id", userIds);

      if (profErr) throw profErr;

      const byId = new Map((profiles || []).map((pr: any) => [pr.id, pr]));
      return filtered.map((p: any) => {
        const prof = byId.get(p.user_id);
        
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

  // Rooms Query
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

  // Real-time subscriptions
  useEffect(() => {
    if (!effectivePracticeId) return;
    
    realtimeManager.subscribe('patient_appointments', () => {
      queryClient.invalidateQueries({ queryKey: ["today-appointments", effectivePracticeId] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments", effectivePracticeId] });
    });

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
        () => {
          refetchRequested();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, effectivePracticeId, refetchRequested]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "completed": return "bg-success text-success-foreground";
      case "no_show": return "bg-destructive text-destructive-foreground";
      default: return "bg-primary text-primary-foreground";
    }
  }, []);

  return (
    <>
      <Card variant="modern" className="h-full">
        <CardHeader className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20">
          <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Calendar className="h-5 w-5" />
            Appointments
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs defaultValue="today" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="today" className="flex items-center gap-2">
                Today
                {!appointmentsLoading && appointments && appointments.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{appointments.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="flex items-center gap-2">
                Upcoming
                {!upcomingLoading && upcomingAppointments && upcomingAppointments.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{upcomingAppointments.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="requested" className="flex items-center gap-2">
                Requested
                {requestedAppointments.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{requestedAppointments.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="mt-0 pt-2">
              {appointmentsLoading ? (
                <div className="min-h-[300px] space-y-3 pt-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : appointments && appointments.length > 0 ? (
                <div className="min-h-[300px] space-y-2 max-h-[400px] overflow-y-auto pr-1 pt-6">
                  {appointments.map((appointment) => (
                    <Button
                      key={appointment.id}
                      variant="ghost"
                      className="w-full justify-start text-left h-auto p-4 hover:bg-accent/50 rounded-lg transition-all duration-200"
                      onClick={() => setSelectedAppointment(appointment)}
                    >
                      <div className="flex items-start justify-between gap-3 w-full">
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
                        <Badge className={`${getStatusColor(appointment.status)} font-medium shrink-0`}>
                          {appointment.status}
                        </Badge>
                      </div>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="min-h-[300px] py-8 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Calendar className="h-16 w-16 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No appointments today</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="upcoming" className="mt-0 pt-2">
              {upcomingLoading ? (
                <div className="min-h-[300px] space-y-3 pt-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : upcomingAppointments && upcomingAppointments.length > 0 ? (
                <div className="min-h-[300px] space-y-2 max-h-[400px] overflow-y-auto pr-1 pt-6">
                  {upcomingAppointments.map((appointment) => (
                    <Button
                      key={appointment.id}
                      variant="ghost"
                      className="w-full justify-start text-left h-auto p-4 hover:bg-accent/50 rounded-lg transition-all duration-200"
                      onClick={() => setSelectedAppointment(appointment)}
                    >
                      <div className="flex items-start justify-between gap-3 w-full">
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
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(appointment.start_time), "MMM d")}
                            <Clock className="h-3.5 w-3.5 ml-2" />
                            {format(new Date(appointment.start_time), "h:mm a")}
                          </div>
                        </div>
                        <Badge className={`${getStatusColor(appointment.status)} font-medium shrink-0`}>
                          {appointment.status}
                        </Badge>
                      </div>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="min-h-[300px] py-8 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Calendar className="h-16 w-16 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No upcoming appointments</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="requested" className="mt-0 pt-2">
              {requestedAppointments.length === 0 ? (
                <div className="min-h-[300px] py-8 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <AlertCircle className="h-16 w-16 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No pending appointment requests</p>
                  </div>
                </div>
              ) : (
                <div className="min-h-[300px] space-y-2 max-h-[400px] overflow-y-auto pr-1 pt-6">
                  {requestedAppointments.map((appointment: any) => {
                    const patientProfile = appointment?.patient_accounts?.profiles;
                    const patientName = patientProfile?.full_name || patientProfile?.name || 'Unknown Patient';
                    const isReschedule = !!appointment.reschedule_requested_at;
                    const requestedAt = appointment.reschedule_requested_at || appointment.start_time;

                    return (
                      <div
                        key={appointment.id}
                        className="p-4 rounded-lg bg-gradient-to-br from-orange-50/50 to-orange-100/30 dark:from-orange-950/20 dark:to-orange-900/10 overflow-hidden transition-all duration-200"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => setSelectedRequest(appointment)}
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
                              onClick={() => setSelectedRequest(appointment)}
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
            </TabsContent>
          </Tabs>
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

      {selectedRequest && (
        <AppointmentRequestReviewDialog
          appointment={selectedRequest}
          open={!!selectedRequest}
          onOpenChange={(open) => !open && setSelectedRequest(null)}
          onSuccess={() => {
            setSelectedRequest(null);
            refetchRequested();
          }}
        />
      )}
    </>
  );
}
