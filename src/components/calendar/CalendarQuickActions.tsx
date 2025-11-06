import { Plus, Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <div className={cn("fixed bottom-40 right-6 z-30 flex flex-col gap-3", className)}>
      {/* Mobile: Dropdown FAB */}
      <div className="lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onNewAppointment}>
              <Plus className="h-4 w-4 mr-2" />
              New Appointment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onWalkIn}>
              <Clock className="h-4 w-4 mr-2" />
              Walk-in Patient
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBlockTime}>
              <Ban className="h-4 w-4 mr-2" />
              Block Time
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop: Stacked Buttons */}
      <div className="hidden lg:flex flex-col gap-2">
        <Button
          size="sm"
          onClick={onNewAppointment}
          className="shadow-md hover:shadow-lg transition-shadow"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Appointment
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onWalkIn}
          className="shadow-md hover:shadow-lg transition-shadow"
        >
          <Clock className="h-4 w-4 mr-2" />
          Walk-in
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onBlockTime}
          className="shadow-md hover:shadow-lg transition-shadow"
        >
          <Ban className="h-4 w-4 mr-2" />
          Block Time
        </Button>
      </div>
    </div>
  );
}
