/**
 * DEPRECATED - Idle Warning Dialog
 * 
 * This component is no longer used. The idle timeout feature has been removed
 * in favor of a simple 60-minute hard session timeout with no warning dialog.
 * 
 * Users are now automatically logged out after exactly 60 minutes from sign-in,
 * regardless of activity. No warning is shown.
 * 
 * This file is kept for reference only.
 */

import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface IdleWarningDialogProps {
  open: boolean;
  secondsRemaining: number;
  onStayLoggedIn: () => void;
  onLogoutNow: () => void;
}

export function IdleWarningDialog({
  open,
  secondsRemaining,
  onStayLoggedIn,
  onLogoutNow,
}: IdleWarningDialogProps) {
  const [countdown, setCountdown] = useState(secondsRemaining);

  useEffect(() => {
    setCountdown(secondsRemaining);
  }, [secondsRemaining]);

  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="border-destructive">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <AlertDialogTitle className="text-destructive">
              Session Timeout Warning
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base pt-2">
            You've been inactive for a while. For your security, you'll be
            automatically logged out in:
          </AlertDialogDescription>
          <div className="text-center py-4">
            <p className="text-4xl font-bold text-destructive">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </p>
          </div>
          <AlertDialogDescription>
            Click "Stay Logged In" to continue your session, or you'll be
            logged out automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onLogoutNow}>
            Log Out Now
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onStayLoggedIn}
            className="bg-primary hover:bg-primary/90"
          >
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
