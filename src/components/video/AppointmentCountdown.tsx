import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { differenceInMinutes } from "date-fns";

interface AppointmentCountdownProps {
  scheduledStartTime: string;
}

export const AppointmentCountdown = ({ scheduledStartTime }: AppointmentCountdownProps) => {
  const [minutesUntil, setMinutesUntil] = useState<number>(0);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const startTime = new Date(scheduledStartTime);
      const diff = differenceInMinutes(startTime, now);
      setMinutesUntil(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [scheduledStartTime]);

  const getCountdownConfig = () => {
    if (minutesUntil < 0) {
      return {
        label: `Delayed (${Math.abs(minutesUntil)}m ago)`,
        className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
      };
    } else if (minutesUntil <= 5) {
      return {
        label: `Ready now (${minutesUntil}m)`,
        className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 animate-pulse'
      };
    } else if (minutesUntil <= 15) {
      return {
        label: `Starts soon (${minutesUntil}m)`,
        className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20'
      };
    } else {
      return {
        label: `Starts in ${minutesUntil}m`,
        className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
      };
    }
  };

  const config = getCountdownConfig();

  return (
    <Badge variant="outline" className={`${config.className} gap-1.5 font-medium`}>
      <Clock className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};