import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MonthViewProps {
  currentDate: Date;
  appointments: any[];
  onDateClick: (date: Date) => void;
  onAppointmentClick: (appointment: any) => void;
}

export function MonthView({ currentDate, appointments, onDateClick, onAppointmentClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter(appt => isSameDay(new Date(appt.start_time), day));
  };

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-500',
    confirmed: 'bg-green-500',
    completed: 'bg-gray-500',
    cancelled: 'bg-red-500',
    no_show: 'bg-orange-500',
  };

  return (
    <div className="border rounded-lg bg-background overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b bg-muted">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-semibold">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayAppointments = getAppointmentsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toString()}
              className={cn(
                "min-h-[120px] border-r border-b p-2 cursor-pointer hover:bg-accent/50 transition-colors",
                !isCurrentMonth && "bg-muted/50 text-muted-foreground",
                isToday && "bg-primary/5 border-primary"
              )}
              onClick={() => onDateClick(day)}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isToday && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                  )}
                >
                  {format(day, 'd')}
                </span>
                {dayAppointments.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {dayAppointments.length}
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                {dayAppointments.slice(0, 3).map((appt) => (
                  <div
                    key={appt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick(appt);
                    }}
                    className={cn(
                      "text-xs p-1 rounded truncate cursor-pointer hover:opacity-80",
                      statusColors[appt.status] || statusColors.scheduled,
                      "text-white"
                    )}
                  >
                    <div className="font-medium">
                      {format(new Date(appt.start_time), 'h:mm a')}
                    </div>
                    <div className="truncate">
                      {appt.patient_accounts?.first_name} {appt.patient_accounts?.last_name}
                    </div>
                  </div>
                ))}
                {dayAppointments.length > 3 && (
                  <div className="text-xs text-muted-foreground pl-1">
                    +{dayAppointments.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
