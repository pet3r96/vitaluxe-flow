import { SidebarTrigger } from "@/components/ui/sidebar";
import { EnhancedCommandPalette } from "./EnhancedCommandPalette";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UserDropdown } from "./UserDropdown";
import { RoleImpersonationDropdown } from "./RoleImpersonationDropdown";
import { ThemeToggle } from "./ThemeToggle";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SessionTimer } from "@/components/auth/SessionTimer";

export function Topbar() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`sticky top-0 z-10 flex items-center justify-between gap-2 sm:gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 transition-shadow duration-300 ${isScrolled ? 'shadow-[0_4px_12px_rgba(190,155,75,0.15)]' : ''}`}>
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
        <SidebarTrigger className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <EnhancedCommandPalette />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Session Timer */}
        {user && (
          <div className="hidden lg:block">
            <SessionTimer userId={user.id} />
          </div>
        )}

        {/* Messages Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/messages")}
          className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg hover:bg-gold1/10"
          aria-label="Messages"
        >
          <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>

        {/* Notifications */}
        <NotificationBell />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Admin Impersonation */}
        <RoleImpersonationDropdown />

        {/* User Avatar Dropdown */}
        <UserDropdown />
      </div>
    </div>
  );
}
