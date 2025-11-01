import { useEffect, useState } from "react";
import { Clock, Info, Activity } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SessionTimerProps {
  userId: string;
}

export const SessionTimer = ({ userId }: SessionTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [wasExtended, setWasExtended] = useState(false);
  const SESSION_EXP_KEY = `vitaluxe_session_exp_${userId}`;
  const SESSION_START_KEY = `vitaluxe_session_start_${userId}`;

  useEffect(() => {
    let prevExpiration = parseInt(localStorage.getItem(SESSION_EXP_KEY) || "0");
    
    const updateTimer = () => {
      const expStr = localStorage.getItem(SESSION_EXP_KEY);
      const startStr = localStorage.getItem(SESSION_START_KEY);
      
      if (!expStr) {
        setTimeRemaining(0);
        return;
      }

      const currentExpiration = parseInt(expStr);
      const remaining = currentExpiration - Date.now();
      setTimeRemaining(Math.max(0, remaining));
      
      // Detect session extension
      if (currentExpiration > prevExpiration && prevExpiration > 0) {
        setWasExtended(true);
        setTimeout(() => setWasExtended(false), 2000); // Show pulse for 2 seconds
      }
      prevExpiration = currentExpiration;
      
      // Calculate total session time
      if (startStr) {
        const sessionStart = parseInt(startStr);
        const totalSessionTime = Date.now() - sessionStart;
        const maxSessionTime = 120 * 60 * 1000; // 2 hours
        
        // If approaching max session time, don't show extended indicator
        if (totalSessionTime > maxSessionTime * 0.9) {
          setWasExtended(false);
        }
      }
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
      {wasExtended ? (
        <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 animate-pulse" />
      ) : (
        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
      )}
      <span className={cn(
        "font-mono text-xs sm:text-sm font-medium transition-colors",
        isCritical && "text-red-600 dark:text-red-400 font-bold animate-pulse",
        isWarning && !isCritical && "text-orange-600 dark:text-orange-400 font-semibold",
        wasExtended && "text-green-600 dark:text-green-400"
      )}>
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </span>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button type="button" className="focus:outline-none focus:ring-2 focus:ring-primary/50 rounded">
            <Info className="h-3 w-3 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          align="center"
          sideOffset={8}
          className="z-[100] max-w-xs bg-popover border border-border shadow-lg"
        >
          <p className="text-sm leading-relaxed">
            Your session automatically extends when you're active. You'll be logged out when this timer reaches zero or after 2 hours maximum for compliance reasons.
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
