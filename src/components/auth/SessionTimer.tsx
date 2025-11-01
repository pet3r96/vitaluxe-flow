import { useEffect, useState } from "react";
import { Clock, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SessionTimerProps {
  userId: string;
}

export const SessionTimer = ({ userId }: SessionTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const SESSION_EXP_KEY = `vitaluxe_session_exp_${userId}`;

  useEffect(() => {
    const updateTimer = () => {
      const expStr = localStorage.getItem(SESSION_EXP_KEY);
      if (!expStr) {
        setTimeRemaining(0);
        return;
      }

      const remaining = parseInt(expStr) - Date.now();
      setTimeRemaining(Math.max(0, remaining));
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [userId]);

  // Format as MM:SS
  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  // Color coding
  const isWarning = minutes < 5;
  const isCritical = minutes < 1;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 bg-background/80 backdrop-blur-sm px-2 sm:px-4 py-1.5 sm:py-2 rounded-md border border-border/50 shadow-sm">
      <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
      <span className={cn(
        "font-mono text-xs sm:text-sm font-medium",
        isCritical && "text-red-600 dark:text-red-400 font-bold animate-pulse",
        isWarning && !isCritical && "text-orange-600 dark:text-orange-400 font-semibold"
      )}>
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">
            You will be automatically logged out when this timer reaches zero for compliance reasons.
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
