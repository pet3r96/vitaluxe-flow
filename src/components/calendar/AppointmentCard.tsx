import { format } from "date-fns";
import { Clock, User, MapPin, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface AppointmentCardProps {
  appointment: any;
  onClick: () => void;
  isDragging?: boolean;
  style?: React.CSSProperties;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-100',
  confirmed: 'bg-green-100 border-green-300 text-green-900 dark:bg-green-950 dark:border-green-700 dark:text-green-100',
  completed: 'bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100',
  cancelled: 'bg-red-100 border-red-300 text-red-900 dark:bg-red-950 dark:border-red-700 dark:text-red-100',
  no_show: 'bg-orange-100 border-orange-300 text-orange-900 dark:bg-orange-950 dark:border-orange-700 dark:text-orange-100',
  checked_in: 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-950 dark:border-amber-600 dark:text-amber-100',
};

export function AppointmentCard({ appointment, onClick, isDragging, style }: AppointmentCardProps) {
  const statusColor = statusColors[appointment.status] || statusColors.scheduled;
  const isWalkIn = appointment.appointment_type === 'walk_in' || appointment.status === 'checked_in';
  
  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        "p-2 rounded-md border-l-4 cursor-pointer transition-all hover:shadow-md overflow-visible",
        statusColor,
        isDragging && "opacity-50 cursor-move"
      )}
    >
      <div className="flex flex-col gap-1">
        {isWalkIn && (
          <Badge variant="secondary" className="w-fit text-[10px] py-0 px-1 bg-amber-500 text-white dark:bg-amber-600">
            <Zap className="h-2.5 w-2.5 mr-0.5" />
            WALK-IN
          </Badge>
        )}
        <p className="font-semibold text-sm leading-tight line-clamp-2">
          {appointment.patient_accounts?.first_name} {appointment.patient_accounts?.last_name}
        </p>
        
        {appointment.providers && (
          <div className="flex items-center gap-1 text-xs opacity-80">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {appointment.providers.first_name} {appointment.providers.last_name}
            </span>
            <span className="text-xs whitespace-nowrap shrink-0 ml-auto">
              {format(new Date(appointment.start_time), 'h:mm a')}
            </span>
          </div>
        )}
        
        {appointment.practice_rooms && (
          <div className="flex items-center gap-1 text-xs opacity-80">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{appointment.practice_rooms.name}</span>
          </div>
        )}
        
        {appointment.appointment_type && (
          <div className="flex items-center gap-1 text-xs opacity-80">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="capitalize truncate">{appointment.appointment_type}</span>
          </div>
        )}
      </div>
    </div>
  );
}
