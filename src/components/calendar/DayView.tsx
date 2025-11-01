import { useMemo, useRef, useEffect } from "react";
import { format, setHours, setMinutes, isSameDay } from "date-fns";
import { AppointmentCard } from "./AppointmentCard";
import { cn } from "@/lib/utils";
import { detectOverlaps } from "@/lib/calendarUtils";

interface DayViewProps {
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

export function DayView({
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
}: DayViewProps) {
  const HOUR_HEIGHT = 88;
  const safeStart = Math.max(0, Math.min(23, startHour ?? 7));
  const safeEnd = Math.max(safeStart + 1, Math.min(24, endHour ?? 20));
  const slotPx = (HOUR_HEIGHT * slotDuration) / 60;
  
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Add "Unassigned" pseudo-provider for appointments without providers
  const providersWithUnassigned = useMemo(() => {
    const hasUnassignedAppointments = appointments.some(
      appt => !appt.provider_id && isSameDay(new Date(appt.start_time), currentDate)
    );
    
    if (hasUnassignedAppointments) {
      return [
        ...providers,
        { 
          id: 'unassigned', 
          first_name: 'Unassigned', 
          last_name: '',
          specialty: 'No Provider'
        }
      ];
    }
    return providers;
  }, [providers, appointments, currentDate]);

  const filteredProviders = useMemo(() => {
    if (selectedProviders.length === 0) return providersWithUnassigned;
    return providersWithUnassigned.filter(p => selectedProviders.includes(p.id));
  }, [providersWithUnassigned, selectedProviders]);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = safeStart; hour < safeEnd; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        slots.push({ hour, minute });
      }
    }
    return slots;
  }, [safeStart, safeEnd, slotDuration]);

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

  const getAppointmentStyle = (appointment: any) => {
    const start = new Date(appointment.start_time);
    const end = new Date(appointment.end_time);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const durationMinutes = endMinutes - startMinutes;
    
    // Clamp to operational hours
    const minMinutes = safeStart * 60;
    const maxMinutes = safeEnd * 60;
    
    // Don't render if completely outside operational hours
    if (endMinutes <= minMinutes || startMinutes >= maxMinutes) {
      return { display: 'none', duration: durationMinutes };
    }
    
    const clampedStart = Math.max(minMinutes, Math.min(maxMinutes, startMinutes));
    const clampedEnd = Math.max(minMinutes, Math.min(maxMinutes, endMinutes));
    
    const top = ((clampedStart - minMinutes) / 60) * HOUR_HEIGHT;
    const height = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT;
    
    // Let content determine minimum height based on duration
    const minHeight = durationMinutes < 30 ? 32 : durationMinutes < 60 ? 48 : 64;
    
    return {
      top: `${top}px`,
      height: `${Math.max(height, minHeight)}px`,
      duration: durationMinutes
    };
  };

  const getAppointmentsForProvider = (providerId: string) => {
    const dayProviderAppointments = appointments.filter(appt => {
      const matchesDay = isSameDay(new Date(appt.start_time), currentDate);
      if (providerId === 'unassigned') {
        return !appt.provider_id && matchesDay;
      }
      return appt.provider_id === providerId && matchesDay;
    });
    return detectOverlaps(dayProviderAppointments);
  };

  const getBlockedTimesForProvider = (providerId: string) => {
    return blockedTime.filter((block) => {
      const blockStart = new Date(block.start_time);
      const blockEnd = new Date(block.end_time);
      const dayMatch = isSameDay(blockStart, currentDate) || 
                       (blockStart <= currentDate && blockEnd >= currentDate);
      
      if (block.block_type === 'practice_closure') {
        return dayMatch;
      }
      
      if (block.block_type === 'provider_unavailable') {
        return dayMatch && block.provider_id === providerId;
      }
      
      return false;
    });
  };

  const getBlockedTimeStyle = (block: any) => {
    const blockStart = new Date(block.start_time);
    const blockEnd = new Date(block.end_time);
    
    const dayStart = new Date(currentDate);
    dayStart.setHours(safeStart, 0, 0, 0);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(safeEnd, 0, 0, 0);
    
    const clampedStart = blockStart < dayStart ? dayStart : blockStart;
    const clampedEnd = blockEnd > dayEnd ? dayEnd : blockEnd;
    
    const startMinutes = (clampedStart.getHours() - safeStart) * 60 + clampedStart.getMinutes();
    const endMinutes = (clampedEnd.getHours() - safeStart) * 60 + clampedEnd.getMinutes();
    const durationMinutes = endMinutes - startMinutes;
    
    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 64);
    
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
      {/* Provider headers */}
      <div className="flex border-b sticky top-0 bg-background z-10">
        <div className="w-20 flex-shrink-0 border-r" />
        {filteredProviders.map((provider) => (
          <div
            key={provider.id}
            className="flex-1 p-3 text-center border-r last:border-r-0"
          >
            <div className="font-semibold text-sm">
              {provider.first_name} {provider.last_name}
            </div>
            {provider.specialty && (
              <div className="text-xs text-muted-foreground">{provider.specialty}</div>
            )}
          </div>
        ))}
      </div>

      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto pt-12 pb-20"
        style={{ height: `${HOUR_HEIGHT * (safeEnd - safeStart)}px` }}
      >
        <div className="flex relative">
          {/* Time labels */}
          <div className="w-20 flex-shrink-0">
            {timeSlots.map(({ hour, minute }) => (
              minute === 0 && (
                <div key={`${hour}-${minute}`} className="pr-3 text-right text-sm text-muted-foreground border-r" style={{ height: `${HOUR_HEIGHT}px` }}>
                  {format(setHours(setMinutes(new Date(), minute), hour), 'h:mm a')}
                </div>
              )
            ))}
          </div>

          {/* Provider columns */}
          {filteredProviders.map((provider) => (
            <div key={provider.id} className="flex-1 border-r last:border-r-0 relative h-full"
              style={{
                backgroundImage: `repeating-linear-gradient(to bottom, hsl(var(--border) / 0.25) 0px, hsl(var(--border) / 0.25) 1px, transparent 1px, transparent ${slotPx}px), repeating-linear-gradient(to bottom, hsl(var(--border)) 0px, hsl(var(--border)) 2px, transparent 2px, transparent ${HOUR_HEIGHT}px)`
              }}
            >
              {timeSlots.map(({ hour, minute }) => {
                const slotDate = setHours(setMinutes(currentDate, minute), hour);
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
              {getBlockedTimesForProvider(provider.id).map((block) => {
                const blockStyle = getBlockedTimeStyle(block);
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
                  {getAppointmentsForProvider(provider.id).map((appointment) => {
                    const styleWithDuration = getAppointmentStyle(appointment);
                    const { duration, ...baseStyle } = styleWithDuration;
                    return (
                      <div
                        key={appointment.id}
                        className="absolute pointer-events-auto px-0.5"
                        style={{
                          ...baseStyle,
                          left: `${appointment.columnLeft}%`,
                          width: `${appointment.columnWidth}%`,
                          zIndex: appointment.columnIndex
                        }}
                      >
                        <AppointmentCard
                          appointment={appointment}
                          onClick={() => onAppointmentClick(appointment)}
                          duration={duration}
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
    </div>
  );
}
