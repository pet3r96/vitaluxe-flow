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
  const [isActive, setIsActive] = useState(true);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const SESSION_EXP_KEY = `vitaluxe_session_exp_${userId}`;
  const SESSION_START_KEY = `vitaluxe_session_start_${userId}`;
  const INACTIVITY_THRESHOLD = 30000; // 30 seconds of inactivity before countdown starts

  // Track user activity
  useEffect(() => {
    const handleActivity = () => {
      setLastActivityTime(Date.now());
      setIsActive(true);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, handleActivity));

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, []);

  // Check activity status
  useEffect(() => {
    const checkActivity = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityTime;
      setIsActive(timeSinceActivity < INACTIVITY_THRESHOLD);
    }, 1000);

    return () => clearInterval(checkActivity);
  }, [lastActivityTime]);

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
      
      // ALWAYS show the real time remaining, regardless of activity status
      // The countdown reflects how much time until forced logout
      const remaining = currentExpiration - Date.now();
      setTimeRemaining(Math.max(0, remaining));
      
      // Detect session extension
      if (currentExpiration > prevExpiration && prevExpiration > 0) {
        setWasExtended(true);
        setTimeout(() => setWasExtended(false), 2000);
      }
      prevExpiration = currentExpiration;
      
      // Calculate total session time
      if (startStr) {
        const sessionStart = parseInt(startStr);
        const totalSessionTime = Date.now() - sessionStart;
        const maxSessionTime = 120 * 60 * 1000;
        
        if (totalSessionTime > maxSessionTime * 0.9) {
          setWasExtended(false);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [userId, isActive]);

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
      ) : isActive ? (
        <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
      ) : (
        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
      )}
      <span className={cn(
        "font-mono text-xs sm:text-sm font-medium transition-colors",
        isActive && "text-blue-600 dark:text-blue-400",
        isCritical && !isActive && "text-red-600 dark:text-red-400 font-bold animate-pulse",
        isWarning && !isCritical && !isActive && "text-orange-600 dark:text-orange-400 font-semibold",
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
            {isActive 
              ? "You're active! Your session automatically extends to 30 minutes from your last activity. Time shown is current countdown until forced logout."
              : "You've been inactive for 30+ seconds. Your session will expire when this timer reaches zero (unless you become active again). Maximum session: 2 hours for compliance."
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
