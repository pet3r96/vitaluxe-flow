import { Plus, Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CalendarQuickActionsProps {
  onNewAppointment: () => void;
  onWalkIn: () => void;
  onBlockTime: () => void;
  className?: string;
}

export function CalendarQuickActions({
  onNewAppointment,
  onWalkIn,
  onBlockTime,
  className
}: CalendarQuickActionsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        size="sm"
        onClick={onNewAppointment}
        className="bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        <Plus className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">New Appointment</span>
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={onWalkIn}
        className="bg-muted hover:bg-muted/80"
      >
        <Clock className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Walk-in</span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onBlockTime}
        className="hidden md:flex"
      >
        <Ban className="h-4 w-4 mr-2" />
        Block Time
      </Button>
    </div>
  );
}
