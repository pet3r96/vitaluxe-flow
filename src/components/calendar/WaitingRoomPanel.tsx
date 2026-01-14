import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { realtimeManager } from "@/lib/realtimeManager";
import { differenceInMinutes, format } from "date-fns";
import { Clock, User, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { CalendarProvider, CalendarAppointment } from '@/types/domain/calendar';

interface WaitingRoomPanelProps {
  practiceId: string;
  providers: CalendarProvider[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  currentDate: Date;
}

export function WaitingRoomPanel({
  practiceId,
  providers,
  onAppointmentClick,
  currentDate,
}: WaitingRoomPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const queryClient = useQueryClient();

  // Fetch overdue appointments (>15 minutes past scheduled time)
  const { data: rawOverdueAppointments = [], refetch: refetchOverdue } = useQuery({
    queryKey: ["overdue-appointments", practiceId, currentDate.toISOString()],
    queryFn: async () => {
      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);
      const fifteenMinutesAgo = new Date();
      fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);

      const { data, error } = await supabase
        .from("patient_appointments")
        .select(`
          *,
          patient:patient_accounts(*),
          provider_id
        `)
        .eq("practice_id", practiceId)
        .in("status", ["scheduled", "confirmed"])
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString())
        .lt("start_time", fifteenMinutesAgo.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!practiceId,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Merge provider data client-side
  const overdueAppointments = rawOverdueAppointments.map((apt: any) => {
    const provider = providers.find((p: any) => p.id === apt.provider_id);
    return {
      ...apt,
      provider: provider ? {
        id: provider.id,
        user: {
          full_name: provider.profiles?.prescriber_name || provider.profiles?.full_name || 'Unassigned'
        }
      } : null
    };
  });

  // Fetch checked-in appointments
  const { data: rawWaitingPatients = [], refetch } = useQuery({
    queryKey: ["waiting-room", practiceId, currentDate.toISOString()],
    queryFn: async () => {
      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("patient_appointments")
        .select(`
          *,
          patient:patient_accounts(*),
          provider_id
        `)
        .eq("practice_id", practiceId)
        .eq("status", "checked_in")
        .gte("checked_in_at", startOfDay.toISOString())
        .lte("checked_in_at", endOfDay.toISOString())
        .order("checked_in_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!practiceId,
  });

  // Merge provider data client-side
  const waitingPatients = rawWaitingPatients.map((apt: any) => {
    const provider = providers.find((p: any) => p.id === apt.provider_id);
    return {
      ...apt,
      provider: provider ? {
        id: provider.id,
        user: {
          full_name: provider.profiles?.prescriber_name || provider.profiles?.full_name || 'Unassigned'
        }
      } : null
    };
  });

  // Real-time subscription for appointments
  useEffect(() => {
    realtimeManager.subscribe('patient_appointments', () => {
      refetch();
      refetchOverdue();
    });

    // Also subscribe to patient_accounts for name/profile updates
    realtimeManager.subscribe('patient_accounts', () => {
      refetch();
    });

    return () => {
      // Manager handles cleanup
    };
  }, [practiceId, refetch, refetchOverdue]);

  const startTreatmentMutation = useOptimisticMutation<void, string>(
    async (appointmentId: string) => {
      const { error } = await supabase
        .from("patient_appointments")
        .update({
          status: "being_treated",
          treatment_started_at: new Date().toISOString(),
        })
        .eq("id", appointmentId);
      if (error) throw error;
    },
    {
      queryKey: ["waiting-room", practiceId, currentDate.toISOString()],
      updateFn: (oldData: any, appointmentId: string) => {
        // Optimistically remove appointment from waiting room
        return oldData?.filter((apt: any) => apt.id !== appointmentId) || [];
      },
      successMessage: "Treatment started - patient moved to being treated",
      errorMessage: "Failed to start treatment",
      onSuccess: () => {
        // Invalidate Being Treated panel to show patient instantly
        queryClient.invalidateQueries({
          queryKey: ["being-treated-appointments", practiceId],
        });
      },
    }
  );

  const handleStartTreatment = (appointmentId: string) => {
    startTreatmentMutation.mutate(appointmentId);
  };

  const handleCheckInOverdue = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from("patient_appointments")
        .update({
          status: "checked_in",
          checked_in_at: new Date().toISOString(),
        })
        .eq("id", appointmentId);

      if (error) throw error;

      toast.success("Patient Checked In", {
        description: "Patient moved to waiting room",
      });

      refetchOverdue();
      refetch();
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "Failed to check in patient",
      });
    }
  };

  const handleMarkNoShow = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from("patient_appointments")
        .update({
          status: "no_show",
        })
        .eq("id", appointmentId);

      if (error) throw error;

      toast.success("Marked as No-Show", {
        description: "Appointment status updated",
      });

      refetchOverdue();
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "Failed to update appointment",
      });
    }
  };

  const getWaitTimeColor = (checkedInAt: string) => {
    const minutes = differenceInMinutes(new Date(), new Date(checkedInAt));
    
    if (minutes < 5) return "bg-card dark:bg-card text-foreground dark:text-white border-l-4 border-l-green-500 hover:bg-muted dark:hover:bg-gray-900";
    if (minutes < 10) return "bg-card dark:bg-card text-foreground dark:text-white border-l-4 border-l-yellow-500 hover:bg-muted dark:hover:bg-gray-900";
    return "bg-card dark:bg-card text-foreground dark:text-white border-l-4 border-l-red-500 hover:bg-muted dark:hover:bg-gray-900 animate-pulse";
  };

  const getWaitTimeIconColor = (checkedInAt: string) => {
    const minutes = differenceInMinutes(new Date(), new Date(checkedInAt));
    
    if (minutes < 5) return "text-green-500";
    if (minutes < 10) return "text-yellow-500";
    return "text-red-500";
  };

  // Calculate total count for display
  const totalCount = waitingPatients.length + overdueAppointments.length;

  return (
    <Card className="bg-card dark:bg-card text-foreground dark:text-white border border-border dark:border-gray-700">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 dark:hover:bg-gray-900/50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Waiting Room</h2>
          {totalCount > 0 && (
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {totalCount}
            </Badge>
          )}
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {!isCollapsed && (
        <div className="p-4 pt-0 space-y-6">
          {/* Overdue Section */}
          {overdueAppointments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  Overdue ({overdueAppointments.length})
                </span>
              </div>
              <div className="space-y-2">
                {overdueAppointments.map((apt: any) => (
                  <div
                    key={apt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20 gap-2"
                  >
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onAppointmentClick(apt)}
                    >
                      <div className="font-medium text-sm truncate">
                        {apt.patient?.first_name} {apt.patient?.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Scheduled: {format(new Date(apt.start_time), "h:mm a")} • 
                        {apt.provider?.user?.full_name || "Unassigned"}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheckInOverdue(apt.id);
                        }}
                      >
                        Check In
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-8 text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkNoShow(apt.id);
                        }}
                      >
                        No Show
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
            </div>
          )}

          {/* Checked-in Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Checked In ({waitingPatients.length})
              </span>
            </div>
            
            {waitingPatients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No patients currently waiting
              </p>
            ) : (
              <div className="space-y-2">
                {waitingPatients.map((apt: any) => {
                  const waitMinutes = differenceInMinutes(
                    new Date(),
                    new Date(apt.checked_in_at)
                  );

                  return (
                    <div
                      key={apt.id}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg transition-colors gap-2",
                        getWaitTimeColor(apt.checked_in_at)
                      )}
                    >
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => onAppointmentClick(apt)}
                      >
                        <div className="font-medium text-sm truncate">
                          {apt.patient?.first_name} {apt.patient?.last_name}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className={cn("h-3 w-3", getWaitTimeIconColor(apt.checked_in_at))} />
                          <span>
                            {waitMinutes} min wait • {apt.provider?.user?.full_name || "Unassigned"}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="text-xs h-8 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartTreatment(apt.id);
                        }}
                        disabled={startTreatmentMutation.isPending}
                      >
                        Start Treatment
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
