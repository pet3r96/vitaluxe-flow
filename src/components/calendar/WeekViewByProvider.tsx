import { useMemo } from "react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ProviderAvatar } from "./ProviderAvatar";
import { Clock, MapPin } from "lucide-react";

interface WeekViewByProviderProps {
  currentDate: Date;
  appointments: any[];
  providers: any[];
  selectedProviders: string[];
  onAppointmentClick: (appointment: any) => void;
  onTimeSlotClick: (date: Date, providerId?: string) => void;
  highlightedAppointmentId?: string | null;
}

export function WeekViewByProvider({
  currentDate,
  appointments,
  providers,
  selectedProviders,
  onAppointmentClick,
  onTimeSlotClick,
  highlightedAppointmentId
}: WeekViewByProviderProps) {
  const weekStart = startOfWeek(currentDate);
  const daysOfWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  const filteredProviders = useMemo(() => {
    if (selectedProviders.length === 0) return providers;
    return providers.filter(p => selectedProviders.includes(p.id));
  }, [providers, selectedProviders]);

  const getAppointmentsForProviderAndDay = (providerId: string, day: Date) => {
    return appointments.filter(apt => 
      apt.provider_id === providerId &&
      isSameDay(new Date(apt.start_time), day) &&
      apt.status !== 'cancelled' &&
      apt.status !== 'no_show'
    ).sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-400 text-yellow-900',
      scheduled: 'bg-sky-400 text-white',
      confirmed: 'bg-emerald-400 text-white',
      checked_in: 'bg-amber-400 text-white',
      being_treated: 'bg-purple-500 text-white',
      completed: 'bg-gray-400 text-white',
    };
    return colors[status] || colors.scheduled;
  };

  if (filteredProviders.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <p>No providers selected. Please select providers from the sidebar.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-lg bg-background overflow-hidden">
      {/* Days Header */}
      <div className="flex border-b sticky top-0 bg-background z-10">
        <div className="w-40 flex-shrink-0 border-r bg-muted/30 p-3">
          <span className="text-sm font-semibold">Provider</span>
        </div>
        {daysOfWeek.map((day) => (
          <div key={day.toString()} className="flex-1 p-3 text-center border-r last:border-r-0 min-w-[120px]">
            <div className="text-xs font-medium text-muted-foreground uppercase">
              {format(day, 'EEE')}
            </div>
            <div className={cn(
              "text-lg font-semibold mt-0.5",
              isSameDay(day, new Date()) && "text-primary"
            )}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Provider Rows */}
      <div className="flex-1 overflow-auto">
        {filteredProviders.map((provider) => (
          <div key={provider.id} className="flex border-b last:border-b-0 hover:bg-accent/5 transition-colors">
            {/* Provider Info */}
            <div className="w-40 flex-shrink-0 border-r p-3 bg-muted/10">
              <div className="flex items-center gap-2">
                <ProviderAvatar provider={provider} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {provider.first_name} {provider.last_name}
                  </div>
                  {provider.specialty && (
                    <div className="text-xs text-muted-foreground truncate">
                      {provider.specialty}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Days */}
            {daysOfWeek.map((day) => {
              const dayAppointments = getAppointmentsForProviderAndDay(provider.id, day);
              
              return (
                <div 
                  key={day.toString()} 
                  className="flex-1 border-r last:border-r-0 p-2 min-w-[120px] cursor-pointer hover:bg-accent/20 transition-colors min-h-[100px]"
                  onClick={() => onTimeSlotClick(day, provider.id)}
                >
                  <div className="space-y-1.5">
                    {dayAppointments.length > 0 ? (
                      dayAppointments.slice(0, 3).map((apt) => (
                        <div
                          key={apt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAppointmentClick(apt);
                          }}
                          data-appointment-id={apt.id}
                          className={cn(
                            "rounded p-1.5 text-xs cursor-pointer hover:shadow-md transition-all border-l-2",
                            getStatusColor(apt.status),
                            highlightedAppointmentId === apt.id && "ring-4 ring-primary ring-offset-2 animate-pulse"
                          )}
                        >
                          <div className="font-semibold truncate">
                            {apt.patient_accounts?.first_name} {apt.patient_accounts?.last_name}
                          </div>
                          <div className="flex items-center gap-1 opacity-90 mt-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            <span className="text-[10px]">
                              {format(new Date(apt.start_time), 'h:mm a')}
                            </span>
                          </div>
                          {apt.practice_rooms && (
                            <div className="flex items-center gap-1 opacity-80 mt-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              <span className="text-[10px] truncate">
                                {apt.practice_rooms.name}
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground text-center py-6">
                        No appointments
                      </div>
                    )}
                    
                    {dayAppointments.length > 3 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 w-full justify-center">
                        +{dayAppointments.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
