import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MessageBell } from "@/components/messages/MessageBell";
import { UserDropdown } from "@/components/layout/UserDropdown";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function PatientMobileHeader() {
  const { effectiveRole, isImpersonating } = useAuth();
  
  // Only show for patient users on mobile
  if (effectiveRole !== 'patient') return null;
  
  return (
    <header 
      className={`sticky z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden ${
        isImpersonating ? 'top-[48px]' : 'top-0'
      }`}
      style={{ touchAction: 'auto' }}>
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
