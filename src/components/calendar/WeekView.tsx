import { useMemo, useRef, useEffect } from "react";
import { format, addDays, startOfWeek, isSameDay, setHours, setMinutes } from "date-fns";
import { AppointmentCard } from "./AppointmentCard";
import { cn } from "@/lib/utils";

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
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const weekStart = startOfWeek(currentDate);
  const daysOfWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  const filteredProviders = useMemo(() => {
    if (selectedProviders.length === 0) return providers;
    return providers.filter(p => selectedProviders.includes(p.id));
  }, [providers, selectedProviders]);

  // Generate time slots - stop before endHour to prevent scrolling past
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        slots.push({ hour, minute });
      }
    }
    return slots;
  }, [startHour, endHour, slotDuration]);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const currentHour = new Date().getHours();
      const scrollPosition = ((currentHour - startHour) / (endHour - startHour)) * scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop = Math.max(0, scrollPosition - 100);
    }
  }, [startHour, endHour]);

  // Calculate appointment positions
  const getAppointmentStyle = (appointment: any) => {
    const start = new Date(appointment.start_time);
    const end = new Date(appointment.end_time);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const slotHeight = 60; // px per hour
    
    const top = ((startMinutes - (startHour * 60)) / 60) * slotHeight;
    const height = ((endMinutes - startMinutes) / 60) * slotHeight;
    
    return {
      top: `${top}px`,
      height: `${Math.max(height, 40)}px`,
      minHeight: '40px'
    };
  };

  const getAppointmentsForDayAndProvider = (day: Date, providerId: string) => {
    return appointments.filter(
      (appt) =>
        isSameDay(new Date(appt.start_time), day) &&
        appt.provider_id === providerId
    );
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex relative">
          {/* Time labels */}
          <div className="w-16 flex-shrink-0">
            {timeSlots.map(({ hour, minute }) => (
              minute === 0 && (
                <div key={`${hour}-${minute}`} className="h-[60px] pr-2 text-right text-xs text-muted-foreground border-r">
                  {format(setHours(setMinutes(new Date(), minute), hour), 'h a')}
                </div>
              )
            ))}
          </div>

          {/* Day columns */}
          {daysOfWeek.map((day) => (
            <div key={day.toString()} className="flex-1 border-r last:border-r-0">
              {filteredProviders.map((provider, providerIndex) => (
                <div
                  key={provider.id}
                  className={cn(
                    "relative",
                    providerIndex > 0 && "border-l border-dashed"
                  )}
                  style={{ minWidth: `${100 / filteredProviders.length}%` }}
                >
                  {timeSlots.map(({ hour, minute }) => {
                    const slotDate = setHours(setMinutes(day, minute), hour);
                    return (
                      <div
                        key={`${hour}-${minute}`}
                        className={cn(
                          "h-[60px] border-b cursor-pointer hover:bg-accent/50 transition-colors",
                          minute === 0 && "border-b-2"
                        )}
                        onClick={() => onTimeSlotClick(slotDate, provider.id)}
                      />
                    );
                  })}
                  
                  {/* Appointments overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="relative h-full">
                      {getAppointmentsForDayAndProvider(day, provider.id).map((appointment) => (
                        <div
                          key={appointment.id}
                          className="absolute left-0 right-0 px-1 pointer-events-auto"
                          style={getAppointmentStyle(appointment)}
                        >
                          <AppointmentCard
                            appointment={appointment}
                            onClick={() => onAppointmentClick(appointment)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
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
