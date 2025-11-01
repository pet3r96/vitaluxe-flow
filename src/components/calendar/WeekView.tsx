import { useMemo, useRef, useEffect } from "react";
import { format, addDays, startOfWeek, isSameDay, setHours, setMinutes } from "date-fns";
import { AppointmentCard } from "./AppointmentCard";
import { cn } from "@/lib/utils";
import { detectOverlaps } from "@/lib/calendarUtils";

interface WeekViewProps {
  currentDate: Date;
  appointments: any[];
  startHour: number;
  endHour: number;
  slotDuration: number;
  onAppointmentClick: (appointment: any) => void;
  onTimeSlotClick: (date: Date, providerId?: string) => void;
  providers: any[];
  selectedProviders: string[];
  blockedTime?: any[];
}

export function WeekView({
  currentDate,
  appointments,
  startHour,
  endHour,
  slotDuration,
  onAppointmentClick,
  onTimeSlotClick,
  providers,
  selectedProviders,
  blockedTime = [],
}: WeekViewProps) {
  const HOUR_HEIGHT = 72;
  const safeStart = Math.max(0, Math.min(23, startHour ?? 7));
  const safeEnd = Math.max(safeStart + 1, Math.min(24, endHour ?? 20));
  const slotPx = (HOUR_HEIGHT * slotDuration) / 60;
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const weekStart = startOfWeek(currentDate);
  const daysOfWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  const filteredProviders = useMemo(() => {
    if (selectedProviders.length === 0) return providers;
    return providers.filter(p => selectedProviders.includes(p.id));
  }, [providers, selectedProviders]);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = safeStart; hour < safeEnd; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        slots.push({ hour, minute });
      }
    }
    return slots;
  }, [safeStart, safeEnd, slotDuration]);

  // Auto-scroll to current time
  useEffect(() => {
    if (scrollRef.current) {
      const currentHour = new Date().getHours();
      const targetHour = currentHour >= safeStart && currentHour < safeEnd ? currentHour : Math.max(safeStart, 8);
      const scrollPosition = ((targetHour - safeStart) * HOUR_HEIGHT) - 100;
      scrollRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, [safeStart, safeEnd]);

  const getAppointmentStyle = (appointment: any) => {
    const start = new Date(appointment.start_time);
    const end = new Date(appointment.end_time);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const durationMinutes = endMinutes - startMinutes;
    
    const minMinutes = safeStart * 60;
    const maxMinutes = safeEnd * 60;
    
    if (endMinutes <= minMinutes || startMinutes >= maxMinutes) {
      return { display: 'none', duration: durationMinutes };
    }
    
    const clampedStart = Math.max(minMinutes, Math.min(maxMinutes, startMinutes));
    const clampedEnd = Math.max(minMinutes, Math.min(maxMinutes, endMinutes));
    
    const top = ((clampedStart - minMinutes) / 60) * HOUR_HEIGHT;
    const height = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT, 36);
    
    return {
      top: `${top}px`,
      height: `${height}px`,
      duration: durationMinutes
    };
  };

  const getAppointmentsForDay = (day: Date) => {
    const dayAppointments = appointments.filter(appt => 
      isSameDay(new Date(appt.start_time), day)
    );
    return detectOverlaps(dayAppointments);
  };

  const getCurrentTimeStyle = (day: Date) => {
    const now = new Date();
    if (!isSameDay(day, now)) return { display: 'none' };
    
    const minutes = now.getHours() * 60 + now.getMinutes();
    const minMinutes = safeStart * 60;
    const maxMinutes = safeEnd * 60;
    
    if (minutes < minMinutes || minutes > maxMinutes) return { display: 'none' };
    
    const top = ((minutes - minMinutes) / 60) * HOUR_HEIGHT;
    return { top: `${top}px` };
  };

  if (filteredProviders.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <p>No providers selected. Please select providers from the filters.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Days Header */}
      <div className="flex border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="w-20 flex-shrink-0 border-r bg-muted/30" />
        {daysOfWeek.map((day) => (
          <div key={day.toString()} className="flex-1 p-4 text-center border-r last:border-r-0">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {format(day, 'EEE')}
            </div>
            <div className={cn(
              "text-2xl font-semibold mt-1",
              isSameDay(day, new Date()) 
                ? "text-primary bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center mx-auto" 
                : "text-foreground"
            )}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex relative" style={{ height: `${HOUR_HEIGHT * (safeEnd - safeStart)}px` }}>
          {/* Time Labels */}
          <div className="w-20 flex-shrink-0 border-r bg-muted/30">
            {timeSlots.map(({ hour, minute }) => (
              minute === 0 && (
                <div key={hour} className="relative" style={{ height: `${HOUR_HEIGHT}px` }}>
                  <div className="absolute -top-2.5 right-3 text-xs font-medium text-muted-foreground">
                    {format(setHours(setMinutes(new Date(), 0), hour), 'h a')}
                  </div>
                </div>
              )
            ))}
          </div>

          {/* Day Columns */}
          {daysOfWeek.map((day) => (
            <div key={day.toString()} className="flex-1 border-r last:border-r-0 relative">
              {/* Grid Background */}
              <div 
                className="absolute inset-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent ${HOUR_HEIGHT - 1}px, hsl(var(--border)) ${HOUR_HEIGHT - 1}px, hsl(var(--border)) ${HOUR_HEIGHT}px)`
                }}
              />
              
              {/* Current Time Indicator */}
              <div 
                className="absolute inset-x-0 h-0.5 bg-red-500 z-30 opacity-80"
                style={getCurrentTimeStyle(day)}
              />
              
              {/* Click Areas */}
              {timeSlots.map(({ hour, minute }) => {
                const slotDate = setHours(setMinutes(day, minute), hour);
                return (
                  <div
                    key={`${hour}-${minute}`}
                    className="absolute inset-x-0 cursor-pointer hover:bg-primary/5 transition-colors"
                    style={{ 
                      top: `${((hour - safeStart) * 60 + minute) / 60 * HOUR_HEIGHT}px`,
                      height: `${slotPx}px`
                    }}
                    onClick={() => onTimeSlotClick(slotDate)}
                  />
                );
              })}

              {/* Appointments */}
              <div className="absolute inset-0 pointer-events-none">
                {getAppointmentsForDay(day).map((appointment) => {
                  const styleWithDuration = getAppointmentStyle(appointment);
                  const { duration, ...baseStyle } = styleWithDuration;
                  
                  return (
                    <div
                      key={appointment.id}
                      className="absolute pointer-events-auto px-1"
                      style={{
                        ...baseStyle,
                        left: `${appointment.columnLeft}%`,
                        width: `${appointment.columnWidth}%`,
                        zIndex: 10 + appointment.columnIndex
                      }}
                    >
                      <div className="h-full">
                        <AppointmentCard
                          appointment={appointment}
                          onClick={() => onAppointmentClick(appointment)}
                          duration={duration}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}