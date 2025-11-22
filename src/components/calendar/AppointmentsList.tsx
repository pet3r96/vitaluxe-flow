import { format, isSameDay, isToday, isTomorrow, startOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight, Clock, MapPin, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppointmentsListProps {
  appointments: any[];
  currentDate: Date;
  onAppointmentClick: (appointment: any) => void;
  selectedAppointmentId?: string;
}

export function AppointmentsList({
  appointments,
  currentDate,
  onAppointmentClick,
  selectedAppointmentId
}: AppointmentsListProps) {
  // Group appointments by date
  const groupedAppointments = appointments.reduce((groups: any, apt: any) => {
    if (apt.status === 'cancelled' || apt.status === 'no_show') return groups;
    
    const date = startOfDay(new Date(apt.start_time));
    const dateKey = date.toISOString();
    
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date,
        appointments: []
      };
    }
    
    groups[dateKey].appointments.push(apt);
    return groups;
  }, {});

  // Sort groups by date
  const sortedGroups = Object.values(groupedAppointments).sort((a: any, b: any) => 
    a.date.getTime() - b.date.getTime()
  );

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMMM d");
  };

  const getAppointmentTypeLabel = (apt: any) => {
    if (apt.visit_type === 'video') return 'Video consultation';
    if (apt.appointment_type === 'walk_in') return 'Walk-in';
    if (apt.visit_type === 'in_person') return 'Office visit';
    return 'Appointment';
  };

  const getAppointmentTypeBadge = (apt: any) => {
    if (apt.visit_type === 'video') {
      return <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">Video consultation</Badge>;
    }
    if (apt.appointment_type === 'walk_in') {
      return <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">Walk-in</Badge>;
    }
    if (apt.status === 'pending') {
      return <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">Pending</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Office visit</Badge>;
  };

  const getPatientName = (apt: any) => {
    if (apt.patient_accounts?.profiles?.full_name) {
      return apt.patient_accounts.profiles.full_name;
    }
    if (apt.patient_accounts?.profiles?.name) {
      return apt.patient_accounts.profiles.name;
    }
    return "Unknown Patient";
  };

  const getPatientInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (sortedGroups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6 sm:p-8 text-center">
        <div className="text-muted-foreground">
          <p className="text-xs sm:text-sm">No appointments scheduled</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 sm:space-y-6 p-3 sm:p-4">
        {sortedGroups.map((group: any) => (
          <div key={group.date.toISOString()}>
            <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-2 sm:mb-3 sticky top-0 bg-card/95 backdrop-blur py-1">
              {getDateLabel(group.date)}, {format(group.date, "MMMM d")}
            </h3>
            <div className="space-y-2">
              {group.appointments.map((apt: any) => {
                const startTime = new Date(apt.start_time);
                const endTime = new Date(apt.end_time);
                const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
                const patientName = getPatientName(apt);
                
                return (
                  <button
                    key={apt.id}
                    onClick={() => onAppointmentClick(apt)}
                    className={cn(
                      "w-full text-left rounded-lg border bg-card hover:bg-accent/50 active:bg-accent/70 transition-colors p-2.5 sm:p-3 space-y-2 touch-manipulation",
                      selectedAppointmentId === apt.id && "ring-2 ring-primary"
                    )}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                        <AvatarImage src={apt.patient_accounts?.profiles?.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                          {getPatientInitials(patientName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <p className="font-medium text-xs sm:text-sm truncate">{patientName}</p>
                          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">View profile</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">
                        {format(startTime, "h:mm a")} – {format(endTime, "h:mm a")} ({duration}m)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      {getAppointmentTypeBadge(apt)}
                      {apt.status === 'pending' && (
                        <Badge variant="outline" className="text-[10px] sm:text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
                          Urgent
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
