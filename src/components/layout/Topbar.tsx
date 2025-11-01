import { SidebarTrigger } from "@/components/ui/sidebar";
import { CommandPalette } from "./CommandPalette";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UserDropdown } from "./UserDropdown";
import { RoleImpersonationDropdown } from "./RoleImpersonationDropdown";
import { ThemeToggle } from "./ThemeToggle";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function Topbar() {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 lg:px-6">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger className="h-9 w-9" />
        <CommandPalette />
      </div>

      <div className="flex items-center gap-2">
        {/* Messages Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/messages")}
          className="h-9 w-9 rounded-lg hover:bg-gold1/10"
          aria-label="Messages"
        >
          <MessageSquare className="h-5 w-5" />
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
