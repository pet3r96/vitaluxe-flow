import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DayViewCalendar() {
  const { effectivePracticeId } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["day-view-calendar", effectivePracticeId, selectedDate],
    enabled: !!effectivePracticeId,
    queryFn: async () => {
      if (!effectivePracticeId) return [];

      const dayStart = startOfDay(selectedDate);
      const dayEnd = endOfDay(selectedDate);

      const { data, error } = await supabase
        .from("patient_appointments")
        .select(`
          id,
          start_time,
          end_time,
          status,
          reason_for_visit,
          patient_account:patient_accounts(id, first_name, last_name)
        `)
        .eq("practice_id", effectivePracticeId)
        .gte("start_time", dayStart.toISOString())
        .lte("start_time", dayEnd.toISOString())
        .neq("status", "cancelled")
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700";
      case "checked_in": return "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700";
      case "pending": return "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700";
      case "no_show": return "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700";
      default: return "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700";
    }
  };

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <Card variant="modern" className="h-full">
      <CardHeader className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-950/30 dark:to-cyan-900/20">
        <CardTitle className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
          <Calendar className="h-5 w-5" />
          Day Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Date Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPreviousDay}
            className="h-8 w-8 p-0"
          >
            ←
          </Button>
          <div className="text-center">
            <div className="font-semibold text-sm">
              {format(selectedDate, 'EEEE')}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(selectedDate, 'MMM d, yyyy')}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextDay}
            className="h-8 w-8 p-0"
          >
            →
          </Button>
        </div>

        {!isToday && (
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="w-full mb-4"
          >
            Today
          </Button>
        )}

        {/* Appointments List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : appointments && appointments.length > 0 ? (
            appointments.map((appointment: any) => (
              <div
                key={appointment.id}
                className={`p-3 rounded-lg border-l-4 ${getStatusColor(appointment.status)} transition-all duration-200`}
              >
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {appointment.patient_account
                        ? `${appointment.patient_account.first_name} ${appointment.patient_account.last_name}`
                        : "Unknown Patient"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(appointment.start_time), "h:mm a")}
                      {appointment.end_time && 
                        ` - ${format(new Date(appointment.end_time), "h:mm a")}`
                      }
                    </div>
                    {appointment.reason_for_visit && (
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        {appointment.reason_for_visit}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No appointments</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
