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
  const [isCollapsed, setIsCollapsed] = useState(true);
  const queryClient = useQueryClient();

  // Fetch video sessions (real sessions with video_sessions records)
  const { data: rawVideoSessions = [], refetch: refetchVideo } = useQuery({
    queryKey: ["video-sessions", practiceId, currentDate.toISOString()],
    queryFn: async () => {
      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);

      console.log('[WaitingRoomPanel] Fetching video sessions:', {
        practiceId,
        dateRange: {
          start: startOfDay.toISOString(),
          end: endOfDay.toISOString()
        }
      });

      const { data, error } = await supabase
        .from("video_sessions")
        .select(`
          *,
          patient_appointments!inner(
            *,
            patient:patient_accounts(*),
            provider_id
          )
        `)
        .eq("practice_id", practiceId)
        .in("status", ["scheduled", "waiting", "active"])
        .gte("scheduled_start_time", startOfDay.toISOString())
        .lte("scheduled_start_time", endOfDay.toISOString())
        .order("scheduled_start_time", { ascending: true });

      if (error) throw error;
      
      console.log('[WaitingRoomPanel] ✅ Video sessions loaded:', {
        count: data?.length || 0,
        sessions: data?.map(s => ({
          id: s.id,
          status: s.status,
          scheduled: s.scheduled_start_time,
          patient: s.patient_appointments?.patient?.first_name
        }))
      });
      
      return data || [];
    },
    enabled: !!practiceId,
    staleTime: 60_000, // Keep data fresh for 60 seconds
    refetchOnWindowFocus: false, // Prevent refetch on tab switching
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  // Fetch video appointments (base appointments for synthetic sessions)
  const { data: rawVideoAppointments = [] } = useQuery({
    queryKey: ["video-appointments-base", practiceId, currentDate.toISOString()],
    queryFn: async () => {
      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      console.log('[WaitingRoomPanel] Fetching video appointments (base):', {
        practiceId,
        dateRange: {
          start: startOfDay.toISOString(),
          end: endOfDay.toISOString()
        }
      });

      const { data, error } = await supabase
        .from("patient_appointments")
        .select(`
          id, patient_id, provider_id, start_time, status, practice_id,
          patient:patient_accounts(id, first_name, last_name, email)
        `)
        .eq("practice_id", practiceId)
        .eq("visit_type", "video")
        .not("status", "in", "(cancelled,completed)")
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString())
        .order("start_time", { ascending: true });
        
      if (error) throw error;
      
      console.log('[WaitingRoomPanel] ✅ Video appointments (base) loaded:', {
        count: data?.length || 0,
        appointments: data?.map(a => ({
          id: a.id,
          status: a.status,
          start: a.start_time,
          patient: a.patient?.first_name
        }))
      });
      
      return data || [];
    },
    enabled: !!practiceId,
    staleTime: 60_000, // Keep data fresh for 60 seconds
    refetchOnWindowFocus: false, // Prevent refetch on tab switching
    refetchInterval: 5000,
  });

  // Merge real sessions with synthetic appointments
  // Build a map of sessions by appointment_id
  const sessionsByAppointment = new Map(
    rawVideoSessions.map(s => [s.appointment_id, s])
  );
  
  // Merge: real sessions + synthetic appointments
  const mergedVideoAppointments: any[] = [];
  
  // Add all real sessions with provider data
  rawVideoSessions.forEach(session => {
    const appointment = session.patient_appointments;
    const provider = providers.find((p: any) => p.id === appointment.provider_id);
    
    mergedVideoAppointments.push({
      ...session,
      patient_appointments: {
        ...appointment,
        provider: provider ? {
          id: provider.id,
          user: {
            full_name: provider.profiles?.prescriber_name || provider.profiles?.full_name || 'Unassigned'
          }
        } : null
      }
    });
  });
  
  // Add synthetic sessions for video appointments without a session record
  rawVideoAppointments.forEach(apt => {
    if (!sessionsByAppointment.has(apt.id)) {
      const provider = providers.find((p: any) => p.id === apt.provider_id);
      
      mergedVideoAppointments.push({
        id: `apt-${apt.id}`,
        appointment_id: apt.id,
        patient_id: apt.patient_id,
        provider_id: apt.provider_id,
        scheduled_start_time: apt.start_time,
        status: apt.status === 'checked_in' ? 'waiting' : 'scheduled',
        isSynthetic: true,
        patient_appointments: {
          id: apt.id,
          patient_id: apt.patient_id,
          provider_id: apt.provider_id,
          start_time: apt.start_time,
          status: apt.status,
          patient: apt.patient,
          provider: provider ? {
            id: provider.id,
            user: {
              full_name: provider.profiles?.prescriber_name || provider.profiles?.full_name || 'Unassigned'
            }
          } : null
        }
      });
    }
  });
  
  // Sort by scheduled time
  mergedVideoAppointments.sort((a, b) => 
    new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime()
  );
  
  const videoAppointments = mergedVideoAppointments;

  console.log('[WaitingRoomPanel] 🔄 Merged video data:', {
    realSessions: rawVideoSessions.length,
    appointments: rawVideoAppointments.length,
    synthetic: mergedVideoAppointments.filter(s => s.isSynthetic).length,
    total: mergedVideoAppointments.length,
    firstTwo: mergedVideoAppointments.slice(0, 2).map(s => ({
      id: s.id,
      isSynthetic: s.isSynthetic,
      provider: s.patient_appointments?.provider?.user?.full_name
    }))
  });

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
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
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

  // Real-time subscription for in-person appointments
  useEffect(() => {
    realtimeManager.subscribe('patient_appointments', () => {
      refetch();
      refetchOverdue();
      refetchVideo(); // Also refetch video when appointments change
    });

    // Also subscribe to patient_accounts for name/profile updates
    realtimeManager.subscribe('patient_accounts', () => {
      refetchVideo();
    });

    return () => {
      // Manager handles cleanup
    };
  }, [practiceId, refetch, refetchOverdue, refetchVideo]);

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
    console.time(`[WaitingRoomPanel] start-video-session-${sessionId}`);
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 12000)
      );
      
      const invokePromise = supabase.functions.invoke('start-video-session', {
        body: { sessionId }
      });

      const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as any;
      console.timeEnd(`[WaitingRoomPanel] start-video-session-${sessionId}`);

      if (error) throw error;

      toast.success("Video Session Started", {
        description: "Patient has been notified via SMS",
      });

      refetchVideo();
    } catch (error: any) {
      console.timeEnd(`[WaitingRoomPanel] start-video-session-${sessionId}`);
      
      if (error.message === 'timeout') {
        toast.info("Still Processing", {
          description: "Starting the session... We'll update the list automatically.",
        });
        // Trigger refetch to show any changes
        setTimeout(() => refetchVideo(), 2000);
      } else {
        toast.error("Error", {
          description: error.message || "Failed to start video session",
        });
      }
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
                          <div className="flex items-center gap-2">
                            <VideoSessionStatus status={session.status} />
                            {session.isSynthetic && (
                              <Badge variant="outline" className="text-xs">
                                Initializing...
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-sm">
                          {timeUntil}
                        </TableCell>
                        <TableCell className="text-right">
                          {session.status === 'scheduled' && (
                            <Button
                              size="sm"
                              disabled={!canStart || session.isSynthetic}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!session.isSynthetic) {
                                  handleStartVideoSession(session.id);
                                }
                              }}
                              className={cn(
                                canStart && !session.isSynthetic
                                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                                  : "opacity-50"
                              )}
                              title={session.isSynthetic ? "Session is initializing. Try again momentarily." : undefined}
                            >
                              {session.isSynthetic 
                                ? "Initializing..." 
                                : canStart 
                                  ? "Start Session" 
                                  : `Wait ${timeUntil}`}
                            </Button>
                          )}
                          {(session.status === 'waiting' || session.status === 'active') && !session.isSynthetic && (
                           <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!session?.id) {
                                  toast.error("Invalid session", {
                                    description: "Unable to join this session"
                                  });
                                  return;
                                }
                                window.open(`/practice/video/${session.id}`, '_blank');
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
