import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MessageBell } from "@/components/messages/MessageBell";
import { UserDropdown } from "@/components/layout/UserDropdown";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Heart } from "lucide-react";

export function PatientMobileHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary" />
          <span className="font-semibold">VitaLuxe</span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          <MessageBell />
          <NotificationBell />
          <ThemeToggle />
          <UserDropdown />
        </div>
      </div>
    </header>
  );
}
