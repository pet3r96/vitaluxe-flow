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
}: DayViewProps) {
  const HOUR_HEIGHT = 80;
  const safeStart = Math.max(0, Math.min(23, startHour ?? 7));
  const safeEnd = Math.max(safeStart + 1, Math.min(24, endHour ?? 20));
  const slotPx = (HOUR_HEIGHT * slotDuration) / 60;
  
  const scrollRef = useRef<HTMLDivElement>(null);
  
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
      height: `${Math.max(height, 50)}px`,
      minHeight: '50px'
    };
  };

  const getAppointmentsForProvider = (providerId: string) => {
    const dayProviderAppointments = appointments.filter(appt =>
      appt.provider_id === providerId && isSameDay(new Date(appt.start_time), currentDate)
    );
    return detectOverlaps(dayProviderAppointments);
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
        className="flex-1 overflow-y-auto"
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
            <div key={provider.id} className="flex-1 border-r last:border-r-0 relative">
              {timeSlots.map(({ hour, minute }) => {
                const slotDate = setHours(setMinutes(currentDate, minute), hour);
                return (
                  <div
                    key={`${hour}-${minute}`}
                    className={cn(
                      "border-b cursor-pointer hover:bg-accent/50 transition-colors",
                      minute === 0 && "border-b-2"
                    )}
                    style={{ height: `${slotPx}px` }}
                    onClick={() => onTimeSlotClick(slotDate, provider.id)}
                  />
                );
              })}
              
              {/* Appointments overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="relative h-full">
                  {getAppointmentsForProvider(provider.id).map((appointment) => {
                    const baseStyle = getAppointmentStyle(appointment);
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
