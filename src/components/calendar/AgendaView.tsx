import { format, isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { Calendar, Clock, User, MapPin, Phone, Mail, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface AgendaViewProps {
  currentDate: Date;
  appointments: any[];
  onAppointmentClick: (appointment: any) => void;
}

const statusConfig: Record<string, { label: string; variant: any }> = {
  scheduled: { label: 'Scheduled', variant: 'default' },
  confirmed: { label: 'Confirmed', variant: 'default' },
  checked_in: { label: 'Checked In', variant: 'default' },
  being_treated: { label: 'Being Treated', variant: 'default' },
  completed: { label: 'Completed', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  no_show: { label: 'No Show', variant: 'destructive' },
};

export function AgendaView({ currentDate, appointments, onAppointmentClick }: AgendaViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Group appointments by date
  const groupedAppointments = appointments.reduce((groups, appt) => {
    const dateKey = format(new Date(appt.start_time), 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(appt);
    return groups;
  }, {} as Record<string, any[]>);

  // Sort dates
  const sortedDates = Object.keys(groupedAppointments).sort();

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <Calendar className="h-12 w-12 mb-4 opacity-50" />
        <p>No appointments scheduled for this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((dateKey) => {
        const date = new Date(dateKey);
        const dayAppointments = groupedAppointments[dateKey].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );

        return (
          <div key={dateKey} className="space-y-3">
            <div className="flex items-center gap-3 sticky top-0 bg-background py-2 z-10">
              <div
                className={cn(
                  "flex flex-col items-center justify-center w-14 h-14 rounded-lg border-2",
                  isSameDay(date, new Date()) && "border-primary bg-primary/10"
                )}
              >
                <span className="text-xs font-medium uppercase">
                  {format(date, 'MMM')}
                </span>
                <span className="text-xl font-bold">{format(date, 'd')}</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {format(date, 'EEEE, MMMM d, yyyy')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {dayAppointments.length} appointment{dayAppointments.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="space-y-2 pl-2">
              {dayAppointments.map((appointment) => {
                const status = statusConfig[appointment.status] || statusConfig.scheduled;
                const isWalkIn = appointment.appointment_type === 'walk_in' || appointment.status === 'checked_in';
                
                return (
                  <Card
                    key={appointment.id}
                    className={cn(
                      "cursor-pointer hover:shadow-md transition-shadow",
                      isWalkIn && "border-l-4 border-l-amber-500"
                    )}
                    onClick={() => onAppointmentClick(appointment)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-sm font-semibold min-w-[80px]">
                              <Clock className="h-4 w-4" />
                              {format(new Date(appointment.start_time), 'h:mm a')}
                            </div>
                            <Separator orientation="vertical" className="h-6" />
                            <div className="font-semibold text-base">
                              {appointment.patient_accounts?.first_name}{' '}
                              {appointment.patient_accounts?.last_name}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                            {appointment.providers && (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <span>
                                  {appointment.providers.first_name} {appointment.providers.last_name}
                                </span>
                              </div>
                            )}

                            {appointment.practice_rooms && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                <span>{appointment.practice_rooms.name}</span>
                              </div>
                            )}

                            {appointment.patient_accounts?.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                <span>{appointment.patient_accounts.phone}</span>
                              </div>
                            )}

                            {appointment.patient_accounts?.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                <span>{appointment.patient_accounts.email}</span>
                              </div>
                            )}
                          </div>

                          {appointment.notes && (
                            <p className="text-sm bg-muted p-2 rounded">{appointment.notes}</p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {isWalkIn && (
                            <Badge variant="warning" size="sm">
                              <Zap className="h-3 w-3 mr-1" />
                              Walk-in
                            </Badge>
                          )}
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {appointment.appointment_type && appointment.appointment_type !== 'walk_in' && (
                            <Badge variant="outline" className="capitalize">
                              {appointment.appointment_type}
                            </Badge>
                          )}
                          {(() => {
                            const durationMins = Math.max(1, Math.round((new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) / 60000));
                            return (
                              <span className="text-xs text-muted-foreground">
                                {durationMins} min
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
