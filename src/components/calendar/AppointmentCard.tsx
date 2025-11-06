import { format } from "date-fns";
import { Clock, User, MapPin, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PatientQuickAccessButton } from "@/components/patients/PatientQuickAccessButton";
import { ProviderAvatar } from "./ProviderAvatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppointmentCardProps {
  appointment: any;
  onClick: () => void;
  isDragging?: boolean;
  style?: React.CSSProperties;
  duration?: number;
  isHighlighted?: boolean;
}

// ENHANCED: Brighter, more saturated colors for better visibility
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-400 border-yellow-500 text-yellow-950 dark:bg-yellow-500 dark:border-yellow-600 dark:text-white',
  scheduled: 'bg-sky-400 border-sky-500 text-white dark:bg-sky-500 dark:border-sky-600',
  confirmed: 'bg-emerald-400 border-emerald-500 text-white dark:bg-emerald-500 dark:border-emerald-600',
  checked_in: 'bg-amber-400 border-amber-500 text-white dark:bg-amber-500 dark:border-amber-600',
  being_treated: 'bg-purple-500 border-purple-600 text-white dark:bg-purple-600 dark:border-purple-700',
  completed: 'bg-gray-400 border-gray-500 text-white dark:bg-gray-500 dark:border-gray-600',
  cancelled: 'bg-red-400 border-red-500 text-white dark:bg-red-500 dark:border-red-600',
  no_show: 'bg-orange-400 border-orange-500 text-white dark:bg-orange-500 dark:border-orange-600',
};

export function AppointmentCard({ appointment, onClick, isDragging, style, duration, isHighlighted }: AppointmentCardProps) {
  const statusColor = statusColors[appointment.status] || statusColors.scheduled;
  const isWalkIn = appointment.appointment_type === 'walk_in' || appointment.status === 'checked_in';
  const isPending = appointment.status === 'pending' && appointment.confirmation_type === 'pending';
  
  // Calculate duration if not provided
  const appointmentDuration = duration ?? (() => {
    const start = new Date(appointment.start_time);
    const end = new Date(appointment.end_time);
    return (end.getTime() - start.getTime()) / (1000 * 60);
  })();

  const patientName = `${appointment.patient_accounts?.first_name} ${appointment.patient_accounts?.last_name}`;
  const providerName = appointment.providers 
    ? `${appointment.providers.first_name} ${appointment.providers.last_name}`
    : null;
  const appointmentTime = format(new Date(appointment.start_time), 'h:mm a');

  // Determine layout based on duration
  // Compact: < 30 min, Standard: 30-60 min, Extended: > 60 min
  const isCompact = appointmentDuration < 30;
  const isExtended = appointmentDuration > 60;
  
  const cardContent = (
    <div
      onClick={onClick}
      style={style}
      data-appointment-id={appointment.id}
      className={cn(
        "rounded-md border-l-4 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] overflow-hidden",
        isCompact ? "p-1.5" : isExtended ? "p-3" : "p-2",
        statusColor,
        isDragging && "opacity-50 cursor-move",
        isWalkIn && "border-l-[6px]",
        isHighlighted && "ring-4 ring-primary ring-offset-2 animate-pulse"
      )}
    >
      {isCompact ? (
        // COMPACT LAYOUT - < 30 minutes
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-1">
            <p className="font-bold text-xs leading-tight truncate flex-1">
              {patientName}
            </p>
            {appointment.patient_id && (
              <PatientQuickAccessButton
                patientId={appointment.patient_id}
                patientName={patientName}
                variant="icon"
                size="sm"
              />
            )}
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold opacity-90">{appointmentTime}</span>
            {(isPending || isWalkIn) && (
              <Badge variant="warning" size="xs" className="text-[9px] px-1 py-0 h-3.5">
                {isPending ? "PENDING" : "WALK-IN"}
              </Badge>
            )}
          </div>
        </div>
      ) : !isExtended ? (
        // STANDARD LAYOUT - 30-60 minutes
        <div className="flex flex-col gap-1">
          {(isPending || isWalkIn) && (
            <Badge variant="warning" size="xs" className="w-fit">
              {isPending ? (
                <>🔔 PENDING APPROVAL</>
              ) : (
                <>
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  WALK-IN
                </>
              )}
            </Badge>
          )}
          <div className="flex items-center gap-1">
            <p className="font-bold text-sm leading-tight truncate flex-1">
              {patientName}
            </p>
            {appointment.patient_id && (
              <PatientQuickAccessButton
                patientId={appointment.patient_id}
                patientName={patientName}
                variant="icon"
                size="sm"
              />
            )}
          </div>
          <div className="flex items-center justify-between gap-1 text-xs opacity-85">
            {providerName && (
              <div className="flex items-center gap-1 truncate flex-1">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate text-xs">{providerName}</span>
              </div>
            )}
            <span className="text-xs font-semibold whitespace-nowrap">{appointmentTime}</span>
          </div>
        </div>
      ) : (
        // EXTENDED LAYOUT - > 60 minutes
        <div className="flex flex-col gap-1">
          {isPending && (
            <Badge variant="warning" size="xs" className="w-fit">
              🔔 PENDING APPROVAL
            </Badge>
          )}
          {isWalkIn && !isPending && (
            <Badge variant="warning" size="xs" className="w-fit">
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              WALK-IN
            </Badge>
          )}
          <div className="flex items-center gap-1">
            <p className="font-bold text-base leading-tight truncate flex-1">
              {patientName}
            </p>
            {appointment.patient_id && (
              <PatientQuickAccessButton
                patientId={appointment.patient_id}
                patientName={patientName}
                variant="icon"
                size="sm"
              />
            )}
          </div>
          
          {providerName && (
            <div className="flex items-center gap-1 text-xs opacity-85">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{providerName}</span>
              <span className="text-xs font-semibold whitespace-nowrap ml-auto">{appointmentTime}</span>
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
      )}
    </div>
  );

  // Wrap compact cards in tooltip to show full details on hover
  if (isCompact) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            {cardContent}
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <p className="font-semibold">{patientName}</p>
              <p>{appointmentTime}</p>
              {providerName && <p>Provider: {providerName}</p>}
              {appointment.practice_rooms && <p>Room: {appointment.practice_rooms.name}</p>}
              {appointment.appointment_type && <p>Type: {appointment.appointment_type}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}
