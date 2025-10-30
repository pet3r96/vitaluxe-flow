import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BeingTreatedPanelProps {
  practiceId: string;
  providers: any[];
  rooms: any[];
  onCompleteAppointment: (appointment: any) => void;
  onAppointmentClick: (appointment: any) => void;
  currentDate: Date;
}

export function BeingTreatedPanel({
  practiceId,
  providers,
  rooms,
  onCompleteAppointment,
  onAppointmentClick,
  currentDate,
}: BeingTreatedPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const startOfDay = new Date(currentDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(currentDate);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: appointments, refetch } = useQuery({
    queryKey: ["being-treated-appointments", practiceId, currentDate.toDateString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_appointments")
        .select(`
          *,
          patient_accounts (
            id,
            first_name,
            last_name,
            email
          ),
          practice_rooms (
            id,
            name
          )
        `)
        .eq("practice_id", practiceId)
        .eq("status", "being_treated")
        .gte("treatment_started_at", startOfDay.toISOString())
        .lte("treatment_started_at", endOfDay.toISOString())
        .order("treatment_started_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 5000, // Poll every 5 seconds as backup
    staleTime: 0, // Consider data immediately stale for instant updates
  });

  useEffect(() => {
    realtimeManager.subscribe('patient_appointments', () => {
      refetch();
    });

    return () => {
      // Manager handles cleanup
    };
  }, [practiceId, refetch]);

  const getProviderName = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    return provider?.user?.profiles?.full_name || "Unknown Provider";
  };

  const getTreatmentDuration = (startedAt: string) => {
    const started = new Date(startedAt);
    const now = new Date();
    const minutes = Math.floor((now.getTime() - started.getTime()) / 60000);
    return minutes;
  };

  const getDurationColor = (minutes: number) => {
    if (minutes < 15) return "border-green-500";
    if (minutes < 30) return "border-yellow-500";
    return "border-red-500 animate-pulse";
  };

  const getDurationBadgeColor = (minutes: number) => {
    if (minutes < 15) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (minutes < 30) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  };

  const patientCount = appointments?.length || 0;

  return (
    <div className="mt-6 rounded-lg border border-purple-200 dark:border-purple-800 bg-card shadow-sm">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Being Treated</h3>
            <p className="text-sm text-muted-foreground">
              {patientCount} {patientCount === 1 ? "patient" : "patients"} currently in treatment
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm">
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="border-t">
          {patientCount === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No patients currently in treatment</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments?.map((appointment) => {
                  const duration = getTreatmentDuration(appointment.treatment_started_at);
                  return (
                    <TableRow
                      key={appointment.id}
                      className={`cursor-pointer hover:bg-muted/50 border-l-4 ${getDurationColor(duration)}`}
                      onClick={() => onAppointmentClick(appointment)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {appointment.patient_accounts?.first_name}{" "}
                            {appointment.patient_accounts?.last_name}
                          </span>
                          {appointment.appointment_type === "walk_in" && (
                            <Badge variant="secondary" className="text-xs">
                              Walk-in
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getProviderName(appointment.provider_id)}</TableCell>
                      <TableCell>
                        {appointment.practice_rooms ? (
                          <Badge variant="secondary">
                            {appointment.practice_rooms.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">No room</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(appointment.treatment_started_at), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge className={getDurationBadgeColor(duration)}>
                          {duration} min
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCompleteAppointment(appointment);
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          Complete Treatment
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
