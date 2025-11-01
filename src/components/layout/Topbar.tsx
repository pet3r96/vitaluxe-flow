import { Bell, Mail, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { RoleImpersonationDropdown } from "./RoleImpersonationDropdown";
import { CommandPalette } from "./CommandPalette";
import { UserDropdown } from "./UserDropdown";
import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Topbar = () => {
  const { user, canImpersonate } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4">
        {/* Sidebar Toggle - Mobile & Tablet */}
        <div className="lg:hidden">
          <SidebarTrigger className="h-9 w-9" />
        </div>

        {/* Logo - Mobile Only */}
        <div className="flex-1 lg:hidden">
          <span className="font-heading text-lg font-bold bg-gradient-to-r from-accent to-accent-hover bg-clip-text text-transparent">
            VITALUXE
          </span>
        </div>

        {/* Desktop: Search & Actions */}
        <div className="hidden lg:flex lg:flex-1 lg:items-center lg:gap-4">
          <CommandPalette />
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile Search */}
          <div className="lg:hidden">
            <CommandPalette />
          </div>

          {/* Notifications */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 relative transition-all duration-300 hover:bg-accent/10"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent animate-pulse" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Notifications</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Messages */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/messages")}
                  className="h-9 w-9 transition-all duration-300 hover:bg-accent/10"
                  aria-label="Messages"
                >
                  <Mail className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Messages</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Impersonation Dropdown - Admin Only */}
          {canImpersonate && <RoleImpersonationDropdown />}

          {/* User Dropdown */}
          <UserDropdown />
        </div>
      </div>
    </header>
  );
};
