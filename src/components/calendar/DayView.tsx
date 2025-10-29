import { useMemo, useRef, useEffect } from "react";
import { format, setHours, setMinutes } from "date-fns";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const filteredProviders = useMemo(() => {
    if (selectedProviders.length === 0) return providers;
    return providers.filter(p => selectedProviders.includes(p.id));
  }, [providers, selectedProviders]);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        slots.push({ hour, minute });
      }
    }
    return slots;
  }, [startHour, endHour, slotDuration]);

  useEffect(() => {
    if (scrollRef.current && appointments.length >= 0) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (scrollRef.current) {
            const currentHour = new Date().getHours();
            const targetHour = currentHour >= startHour && currentHour < endHour 
              ? currentHour 
              : Math.max(startHour, 8);
            
            const scrollPosition = ((targetHour - startHour) / (endHour - startHour)) * scrollRef.current.scrollHeight;
            scrollRef.current.scrollTop = Math.max(0, scrollPosition - 100);
          }
        }, 100);
      });
    }
  }, [startHour, endHour, appointments.length]);

  const getAppointmentStyle = (appointment: any) => {
    const start = new Date(appointment.start_time);
    const end = new Date(appointment.end_time);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const slotHeight = 80;
    
    const top = ((startMinutes - (startHour * 60)) / 60) * slotHeight;
    const height = ((endMinutes - startMinutes) / 60) * slotHeight;
    
    console.log('🗓️ Day View Appointment Debug:', {
      rawStartTime: appointment.start_time,
      rawEndTime: appointment.end_time,
      parsedStart: start.toLocaleString(),
      parsedEnd: end.toLocaleString(),
      startHour,
      startMinutes,
      endMinutes,
      calculatedTop: top,
      calculatedHeight: height,
      patientName: appointment.patient_name
    });
    
    return {
      top: `${top}px`,
      height: `${Math.max(height, 50)}px`,
      minHeight: '50px'
    };
  };

  const getAppointmentsForProvider = (providerId: string) => {
    const providerAppointments = appointments.filter(appt => appt.provider_id === providerId);
    return detectOverlaps(providerAppointments);
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
        style={{ maxHeight: `${(endHour - startHour) * 80}px` }}
      >
        <div className="flex relative">
          {/* Time labels */}
          <div className="w-20 flex-shrink-0">
            {timeSlots.map(({ hour, minute }) => (
              minute === 0 && (
                <div key={`${hour}-${minute}`} className="h-[80px] pr-3 text-right text-sm text-muted-foreground border-r">
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
                      "h-[80px] border-b cursor-pointer hover:bg-accent/50 transition-colors",
                      minute === 0 && "border-b-2"
                    )}
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
