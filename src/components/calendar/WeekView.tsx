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
  const HOUR_HEIGHT = 60;
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

  // Generate time slots using safe operational hours
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = safeStart; hour < safeEnd; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        slots.push({ hour, minute });
      }
    }
    return slots;
  }, [safeStart, safeEnd, slotDuration]);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current && appointments.length >= 0) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (scrollRef.current) {
            const currentHour = new Date().getHours();
            const targetHour = currentHour >= safeStart && currentHour < safeEnd 
              ? currentHour 
              : Math.max(safeStart, 8);
            
            const scrollPosition = ((targetHour - safeStart) / (safeEnd - safeStart)) * scrollRef.current.scrollHeight;
            scrollRef.current.scrollTop = Math.max(0, scrollPosition - 100);
          }
        }, 100);
      });
    }
  }, [safeStart, safeEnd, appointments.length]);

  // Calculate appointment positions with bounds checking
  const getAppointmentStyle = (appointment: any) => {
    const start = new Date(appointment.start_time);
    const end = new Date(appointment.end_time);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    
    // Clamp to operational hours
    const minMinutes = safeStart * 60;
    const maxMinutes = safeEnd * 60;
    
    // Don't render if completely outside operational hours
    if (endMinutes <= minMinutes || startMinutes >= maxMinutes) {
      return { display: 'none' };
    }
    
    const clampedStart = Math.max(minMinutes, Math.min(maxMinutes, startMinutes));
    const clampedEnd = Math.max(minMinutes, Math.min(maxMinutes, endMinutes));
    
    const top = ((clampedStart - minMinutes) / 60) * HOUR_HEIGHT;
    const height = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT;
    
    return {
      top: `${top}px`,
      height: `${Math.max(height, 40)}px`,
      minHeight: '40px'
    };
  };

  const getAppointmentsForDayAndProvider = (day: Date, providerId: string) => {
    const dayProviderAppointments = appointments.filter(
      (appt) =>
        isSameDay(new Date(appt.start_time), day) &&
        appt.provider_id === providerId
    );
    return detectOverlaps(dayProviderAppointments);
  };

  const getBlockedTimesForDayAndProvider = (day: Date, providerId: string) => {
    return blockedTime.filter((block) => {
      const blockStart = new Date(block.start_time);
      const blockEnd = new Date(block.end_time);
      const dayMatch = isSameDay(blockStart, day) || (blockStart <= day && blockEnd >= day);
      
      if (block.block_type === 'practice_closure') {
        return dayMatch;
      }
      
      if (block.block_type === 'provider_unavailable') {
        return dayMatch && block.provider_id === providerId;
      }
      
      return false;
    });
  };

  const getBlockedTimeStyle = (block: any, day: Date) => {
    const blockStart = new Date(block.start_time);
    const blockEnd = new Date(block.end_time);
    
    const dayStart = new Date(day);
    dayStart.setHours(safeStart, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(safeEnd, 0, 0, 0);
    
    const clampedStart = blockStart < dayStart ? dayStart : blockStart;
    const clampedEnd = blockEnd > dayEnd ? dayEnd : blockEnd;
    
    const startMinutes = (clampedStart.getHours() - safeStart) * 60 + clampedStart.getMinutes();
    const endMinutes = (clampedEnd.getHours() - safeStart) * 60 + clampedEnd.getMinutes();
    const durationMinutes = endMinutes - startMinutes;
    
    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 40);
    
    return { top: `${top}px`, height: `${height}px` };
  };

  if (filteredProviders.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <p>No providers selected. Please select providers from the filters.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-lg bg-background">
      {/* Header with days */}
      <div className="flex border-b sticky top-0 bg-background z-10">
        <div className="w-16 flex-shrink-0 border-r" />
        {daysOfWeek.map((day) => (
          <div
            key={day.toString()}
            className="flex-1 p-2 text-center border-r last:border-r-0"
          >
            <div className="text-sm font-semibold">{format(day, 'EEE')}</div>
            <div
              className={cn(
                "text-2xl",
                isSameDay(day, new Date()) && "text-primary font-bold"
              )}
            >
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-hidden"
        style={{ height: `${HOUR_HEIGHT * (safeEnd - safeStart)}px` }}
      >
        <div className="flex relative">
          {/* Time labels */}
          <div className="w-16 flex-shrink-0">
            {timeSlots.map(({ hour, minute }) => (
              minute === 0 && (
                <div key={`${hour}-${minute}`} className="pr-2 text-right text-xs text-muted-foreground border-r" style={{ height: `${HOUR_HEIGHT}px` }}>
                  {format(setHours(setMinutes(new Date(), minute), hour), 'h a')}
                </div>
              )
            ))}
          </div>

          {/* Day columns */}
          {daysOfWeek.map((day) => (
            <div key={day.toString()} className="flex-1 border-r last:border-r-0 h-full">
              <div className="flex h-full">
                {filteredProviders.map((provider, providerIndex) => (
                  <div
                    key={provider.id}
                    className={cn(
                      "flex-1 relative h-full",
                      providerIndex > 0 && "border-l border-dashed"
                    )}
                    style={{
                      backgroundImage: `repeating-linear-gradient(to bottom, hsl(var(--border) / 0.25) 0px, hsl(var(--border) / 0.25) 1px, transparent 1px, transparent ${slotPx}px), repeating-linear-gradient(to bottom, hsl(var(--border)) 0px, hsl(var(--border)) 2px, transparent 2px, transparent ${HOUR_HEIGHT}px)`
                    }}
                  >
                    {timeSlots.map(({ hour, minute }) => {
                      const slotDate = setHours(setMinutes(day, minute), hour);
                      return (
                        <div
                          key={`${hour}-${minute}`}
                          className="cursor-pointer hover:bg-accent/50 transition-colors"
                          style={{ height: `${slotPx}px` }}
                          onClick={() => onTimeSlotClick(slotDate, provider.id)}
                        />
                      );
                    })}
                    
                    {/* Blocked time overlays */}
                    {getBlockedTimesForDayAndProvider(day, provider.id).map((block) => {
                      const blockStyle = getBlockedTimeStyle(block, day);
                      return (
                        <div
                          key={block.id}
                          className="absolute inset-x-0 blocked-time-slot pointer-events-none flex items-center justify-center px-2"
                          style={blockStyle}
                        >
                          <span className="text-xs font-medium text-muted-foreground text-center">
                            Blocked: {block.reason || 'Unavailable'}
                          </span>
                        </div>
                      );
                    })}

                    {/* Appointments overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="relative h-full">
                        {getAppointmentsForDayAndProvider(day, provider.id).map((appointment) => {
                          const baseStyle = getAppointmentStyle(appointment);
                          return (
                            <div
                              key={appointment.id}
                              className="absolute pointer-events-auto px-0.5"
                              style={{
                                ...baseStyle,
                                left: `${appointment.columnLeft}%`,
                                width: `${appointment.columnWidth}%`,
                                minHeight: '64px',
                                zIndex: appointment.columnIndex
                              }}
                            >
                              <AppointmentCard
                                appointment={appointment}
                                onClick={() => onAppointmentClick(appointment)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provider legend */}
      {filteredProviders.length > 1 && (
        <div className="border-t p-2 flex gap-2 flex-wrap bg-muted/50">
          {filteredProviders.map((provider) => (
            <div key={provider.id} className="text-xs flex items-center gap-1 px-2 py-1 bg-background rounded">
              <span className="font-medium">
                {provider.first_name} {provider.last_name}
              </span>
              {provider.specialty && (
                <span className="text-muted-foreground">({provider.specialty})</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
