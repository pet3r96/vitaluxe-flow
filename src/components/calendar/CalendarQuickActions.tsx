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
    <div className={cn("flex items-center gap-2 px-4 py-3 border-t bg-muted/30", className)}>
      {/* Mobile: Horizontal Buttons */}
      <div className="flex gap-2 w-full lg:hidden">
        <Button
          size="sm"
          onClick={onNewAppointment}
          className="flex-1"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          <span className="hidden xs:inline">New Appointment</span>
          <span className="xs:hidden">New</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onWalkIn}
          className="flex-1"
        >
          <Clock className="h-4 w-4 mr-1.5" />
          <span className="hidden xs:inline">Walk-in</span>
          <span className="xs:hidden">Walk</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onBlockTime}
          className="flex-1"
        >
          <Ban className="h-4 w-4 mr-1.5" />
          <span className="hidden xs:inline">Block Time</span>
          <span className="xs:hidden">Block</span>
        </Button>
      </div>

      {/* Desktop: Horizontal Buttons */}
      <div className="hidden lg:flex gap-2">
        <Button
          size="sm"
          onClick={onNewAppointment}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Appointment
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onWalkIn}
        >
          <Clock className="h-4 w-4 mr-2" />
          Walk-in
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onBlockTime}
        >
          <Ban className="h-4 w-4 mr-2" />
          Block Time
        </Button>
      </div>
    </div>
  );
}
