import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileCalendarFABProps {
  onClick: () => void;
  className?: string;
}

export function MobileCalendarFAB({ onClick, className }: MobileCalendarFABProps) {
  return (
    <Button
      size="lg"
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:hidden z-40 touch-manipulation",
        "bg-primary hover:bg-primary/90 active:scale-95 transition-all duration-200",
        className
      )}
    >
      <Plus className="h-6 w-6" />
      <span className="sr-only">New Appointment</span>
    </Button>
  );
}
