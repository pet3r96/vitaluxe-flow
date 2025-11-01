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
    <div className={`sticky top-0 z-10 flex items-center justify-between gap-1.5 sm:gap-2 md:gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-2 sm:px-3 md:px-4 lg:px-6 py-1.5 sm:py-2 md:py-3 transition-shadow duration-300 ${isScrolled ? 'shadow-[0_4px_12px_rgba(190,155,75,0.15)]' : ''}`}>
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 flex-1 min-w-0">
        <SidebarTrigger className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 flex-shrink-0" />
        <div className="flex-1 min-w-0 max-w-full">
          <EnhancedCommandPalette />
        </div>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 flex-shrink-0">
        {/* Messages Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/messages")}
          className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 rounded-lg hover:bg-gold1/10"
          aria-label="Messages"
        >
          <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
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
