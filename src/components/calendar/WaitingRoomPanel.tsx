import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { realtimeManager } from "@/lib/realtimeManager";
import { differenceInMinutes, format } from "date-fns";
import { Clock, User, ChevronDown, ChevronUp, Video, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { VideoSessionStatus } from "@/components/video/VideoSessionStatus";
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

interface WaitingRoomPanelProps {
  practiceId: string;
  providers: any[];
  onAppointmentClick: (appointment: any) => void;
  currentDate: Date;
}

export function WaitingRoomPanel({
  practiceId,
  providers,
  onAppointmentClick,
  currentDate,
}: WaitingRoomPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const queryClient = useQueryClient();

  // Fetch video appointments
  const { data: videoAppointments = [], refetch: refetchVideo } = useQuery({
    queryKey: ["video-appointments", practiceId, currentDate.toISOString()],
    queryFn: async () => {
      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("video_sessions")
        .select(`
          *,
          patient_appointments!inner(
            *,
            patient:patient_accounts(*),
            provider:providers!patient_appointments_provider_id_fkey(
              id,
              user:profiles!providers_user_id_fkey(full_name)
            )
          )
        `)
        .eq("practice_id", practiceId)
        .in("status", ["scheduled", "waiting", "active"])
        .gte("scheduled_start_time", startOfDay.toISOString())
        .lte("scheduled_start_time", endOfDay.toISOString())
        .order("scheduled_start_time", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!practiceId,
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  // Fetch overdue appointments (>15 minutes past scheduled time)
  const { data: overdueAppointments = [], refetch: refetchOverdue } = useQuery({
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
          provider:providers!patient_appointments_provider_id_fkey(
            id,
            user:profiles!providers_user_id_fkey(full_name)
          )
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
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  // Fetch checked-in appointments
  const { data: waitingPatients = [], refetch } = useQuery({
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
          provider:providers!patient_appointments_provider_id_fkey(
            id,
            user:profiles!providers_user_id_fkey(full_name)
          )
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

  // Real-time subscription for in-person appointments
  useEffect(() => {
    realtimeManager.subscribe('patient_appointments', () => {
      refetch();
      refetchOverdue();
    });

    return () => {
      // Manager handles cleanup
    };
  }, [practiceId, refetch, refetchOverdue]);

  // Real-time subscription for video sessions
  useEffect(() => {
    const channel = supabase
      .channel('video_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_sessions'
        },
        () => {
          refetchVideo();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [practiceId, refetchVideo]);

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

  const handleStartVideoSession = async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('start-video-session', {
        body: { sessionId }
      });

      if (error) throw error;

      toast.success("Video Session Started", {
        description: "Patient has been notified via SMS",
      });

      refetchVideo();
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "Failed to start video session",
      });
    }
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

  // Helper functions for video appointments
  const canStartVideoSession = (scheduledTime: string, status: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledTime);
    const minutesUntil = differenceInMinutes(scheduled, now);
    
    // Can start if within 15 minutes before or anytime after scheduled time
    return status === 'scheduled' && minutesUntil <= 15;
  };

  const getTimeUntilText = (scheduledTime: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledTime);
    const minutesUntil = differenceInMinutes(scheduled, now);
    
    if (minutesUntil < 0) return "Ready now";
    if (minutesUntil === 0) return "Starting now";
    if (minutesUntil < 60) return `In ${minutesUntil} min`;
    const hours = Math.floor(minutesUntil / 60);
    return `In ${hours}h ${minutesUntil % 60}m`;
  };

  const getVideoAppointmentColor = (scheduledTime: string, status: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledTime);
    const minutesUntil = differenceInMinutes(scheduled, now);
    
    if (status === 'waiting') return "bg-card border-l-4 border-l-blue-500 hover:bg-muted/50";
    if (status === 'active') return "bg-card border-l-4 border-l-green-500 animate-pulse hover:bg-muted/50";
    if (minutesUntil <= 0) return "bg-card border-l-4 border-l-green-500 hover:bg-muted/50";
    if (minutesUntil <= 5) return "bg-card border-l-4 border-l-yellow-500 hover:bg-muted/50";
    return "bg-card border-l-4 border-l-muted hover:bg-muted/50";
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

  const getWaitTimeText = (checkedInAt: string) => {
    const minutes = differenceInMinutes(new Date(), new Date(checkedInAt));
    return `${minutes} min${minutes !== 1 ? "s" : ""}`;
  };

  // Helper functions for overdue appointments
  const getOverdueMinutes = (startTime: string) => {
    return differenceInMinutes(new Date(), new Date(startTime));
  };

  const getOverdueColor = () => {
    return "bg-card dark:bg-card text-foreground dark:text-white border-l-4 border-l-red-500 hover:bg-muted dark:hover:bg-gray-900 animate-pulse";
  };

  return (
    <Card className="border-t bg-background max-h-[500px] flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          {overdueAppointments.length > 0 ? (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          ) : videoAppointments.length > 0 ? (
            <Video className="h-5 w-5 text-primary" />
          ) : (
            <Clock className="h-5 w-5 text-primary" />
          )}
          <h2 className="text-lg font-semibold">
            Waiting Room
            {(overdueAppointments.length + videoAppointments.length + waitingPatients.length) > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({overdueAppointments.length + videoAppointments.length + waitingPatients.length})
              </span>
            )}
          </h2>
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-5 w-5" />
        ) : (
          <ChevronUp className="h-5 w-5" />
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="overflow-y-auto flex-1">
          {/* Overdue Appointments Section */}
          {overdueAppointments.length > 0 && (
            <div className="mb-4">
              <div className="bg-red-500/10 px-4 py-2 flex items-center gap-2 border-l-4 border-l-red-500">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold text-red-500">Overdue Appointments</h3>
                <Badge variant="destructive" className="ml-auto">
                  {overdueAppointments.length}
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Scheduled Time</TableHead>
                    <TableHead>Overdue</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueAppointments.map((appointment: any) => {
                    const overdueMinutes = getOverdueMinutes(appointment.start_time);
                    
                    return (
                      <TableRow
                        key={appointment.id}
                        className={cn(
                          "cursor-pointer",
                          getOverdueColor()
                        )}
                        onClick={() => onAppointmentClick(appointment)}
                      >
                        <TableCell className="font-medium">
                          {appointment.patient?.first_name}{" "}
                          {appointment.patient?.last_name}
                        </TableCell>
                        <TableCell>
                          {appointment.provider?.user?.full_name || "Unassigned"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(appointment.start_time), "h:mm a")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="font-semibold">
                            OVERDUE: {overdueMinutes} min
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCheckInOverdue(appointment.id);
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              Check In Now
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkNoShow(appointment.id);
                              }}
                            >
                              Mark No-Show
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Separator between overdue and video sections */}
          {overdueAppointments.length > 0 && videoAppointments.length > 0 && (
            <Separator className="my-4" />
          )}

          {/* Video Appointments Section */}
          {videoAppointments.length > 0 && (
            <div className="mb-4">
              <div className="bg-muted/30 px-4 py-2 flex items-center gap-2">
                <Video className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-semibold">Video Consultations</h3>
                <Badge variant="secondary" className="ml-auto">
                  {videoAppointments.length}
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Scheduled Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time Until</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videoAppointments.map((session: any) => {
                    const appointment = session.patient_appointments;
                    const canStart = canStartVideoSession(session.scheduled_start_time, session.status);
                    const timeUntil = getTimeUntilText(session.scheduled_start_time);
                    
                    return (
                      <TableRow
                        key={session.id}
                        className={cn(
                          "cursor-pointer",
                          getVideoAppointmentColor(session.scheduled_start_time, session.status)
                        )}
                        onClick={() => onAppointmentClick(appointment)}
                      >
                        <TableCell className="font-medium">
                          {appointment.patient?.first_name}{" "}
                          {appointment.patient?.last_name}
                        </TableCell>
                        <TableCell>
                          {appointment.provider?.user?.full_name || "Unassigned"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(session.scheduled_start_time), "h:mm a")}
                        </TableCell>
                        <TableCell>
                          <VideoSessionStatus status={session.status} />
                        </TableCell>
                        <TableCell className="font-semibold text-sm">
                          {timeUntil}
                        </TableCell>
                        <TableCell className="text-right">
                          {session.status === 'scheduled' && (
                            <Button
                              size="sm"
                              disabled={!canStart}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartVideoSession(session.id);
                              }}
                              className={cn(
                                canStart 
                                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                                  : "opacity-50"
                              )}
                            >
                              {canStart ? "Start Session" : `Wait ${timeUntil}`}
                            </Button>
                          )}
                          {(session.status === 'waiting' || session.status === 'active') && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/video/${session.id}`, '_blank');
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              Join Session
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Separator between video and in-person sections */}
          {(overdueAppointments.length > 0 || videoAppointments.length > 0) && waitingPatients.length > 0 && (
            <Separator className="my-4" />
          )}

          {/* In-Person Waiting Room Section */}
          {waitingPatients.length > 0 && (
            <div>
              <div className="bg-muted/30 px-4 py-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">In-Person Waiting Room</h3>
                <Badge variant="secondary" className="ml-auto">
                  {waitingPatients.length}
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Check-in Time</TableHead>
                    <TableHead>Wait Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waitingPatients.map((appointment: any) => (
                    <TableRow
                      key={appointment.id}
                      className={cn(
                        "cursor-pointer",
                        appointment.checked_in_at &&
                          getWaitTimeColor(appointment.checked_in_at)
                      )}
                      onClick={() => onAppointmentClick(appointment)}
                    >
                      <TableCell className="font-medium">
                        {appointment.patient?.first_name}{" "}
                        {appointment.patient?.last_name}
                        {appointment.appointment_type === "walk_in" && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (Walk-in)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {appointment.provider?.user?.full_name || "Unassigned"}
                      </TableCell>
                      <TableCell>
                        {appointment.checked_in_at
                          ? format(
                              new Date(appointment.checked_in_at),
                              "h:mm a"
                            )
                          : "-"}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {appointment.checked_in_at ? (
                          <div className="flex items-center gap-1">
                            <Clock className={cn("h-3 w-3", getWaitTimeIconColor(appointment.checked_in_at))} />
                            {getWaitTimeText(appointment.checked_in_at)}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartTreatment(appointment.id);
                          }}
                        >
                          Start Treatment
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Empty state when all sections are empty */}
          {overdueAppointments.length === 0 && videoAppointments.length === 0 && waitingPatients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mb-2 opacity-20" />
              <p className="text-sm">No patients waiting today</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
