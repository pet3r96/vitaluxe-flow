import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { differenceInMinutes, format } from "date-fns";
import { Clock, User, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
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

  // Fetch checked-in appointments
  const { data: waitingPatients = [], refetch } = useQuery({
    queryKey: ["waiting-room", practiceId, currentDate],
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
            user:profiles(name)
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

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("waiting-room-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patient_appointments",
          filter: `practice_id=eq.${practiceId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [practiceId, refetch]);

  const handleStartTreatment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from("patient_appointments")
        .update({
          status: "being_treated",
          treatment_started_at: new Date().toISOString(),
        })
        .eq("id", appointmentId);

      if (error) throw error;

      toast({
        title: "Treatment started",
        description: "Patient status updated to being treated",
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getWaitTimeColor = (checkedInAt: string) => {
    const minutes = differenceInMinutes(new Date(), new Date(checkedInAt));

    if (minutes < 5) return "bg-green-50 hover:!bg-green-100 border-l-4 border-l-green-500";
    if (minutes < 10) return "bg-yellow-50 hover:!bg-yellow-100 border-l-4 border-l-yellow-500";
    return "bg-red-50 hover:!bg-red-100 border-l-4 border-l-red-500 animate-pulse";
  };

  const getWaitTimeText = (checkedInAt: string) => {
    const minutes = differenceInMinutes(new Date(), new Date(checkedInAt));
    return `${minutes} min${minutes !== 1 ? "s" : ""}`;
  };

  return (
    <div className="border-t bg-background">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">
            Waiting Room
            {waitingPatients.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({waitingPatients.length})
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
        <div className="max-h-64 overflow-auto">
          {waitingPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mb-2 opacity-20" />
              <p className="text-sm">No patients in waiting room</p>
            </div>
          ) : (
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
                      {appointment.provider?.user?.name || "Unassigned"}
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
                          <Clock className="h-3 w-3" />
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
          )}
        </div>
      )}
    </div>
  );
}
