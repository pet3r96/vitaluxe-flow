import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MiniCalendarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  appointments?: any[];
}

export function MiniCalendar({ currentDate, onDateChange, appointments = [] }: MiniCalendarProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = useMemo(() => 
    eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
    [calendarStart, calendarEnd]
  );

  const getAppointmentCount = (day: Date) => {
    return appointments.filter(apt => 
      isSameDay(new Date(apt.start_time), day) && 
      apt.status !== 'cancelled' && 
      apt.status !== 'no_show'
    ).length;
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  return (
    <div className="w-full">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6"
          onClick={handlePrevMonth}
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <h3 className="text-sm font-semibold">
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6"
          onClick={handleNextMonth}
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, currentDate);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const count = getAppointmentCount(day);

          return (
            <button
              key={day.toString()}
              onClick={() => onDateChange(day)}
              className={cn(
                "relative aspect-square flex flex-col items-center justify-center rounded text-xs transition-colors",
                isCurrentMonth ? "text-foreground" : "text-muted-foreground/40",
                isToday && "font-bold",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && "hover:bg-accent",
                !isCurrentMonth && !isSelected && "opacity-50"
              )}
            >
              <span>{format(day, 'd')}</span>
              {count > 0 && isCurrentMonth && !isSelected && (
                <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary" />
              )}
              {count > 3 && isCurrentMonth && !isSelected && (
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  <div className="w-0.5 h-0.5 rounded-full bg-primary" />
                  <div className="w-0.5 h-0.5 rounded-full bg-primary" />
                  <div className="w-0.5 h-0.5 rounded-full bg-primary" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
