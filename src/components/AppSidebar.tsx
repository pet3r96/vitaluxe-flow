import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { NavLink } from "react-router-dom";
import { UpgradeDialog } from "@/components/subscription/UpgradeDialog";
import { useResponsive } from "@/hooks/use-mobile";
import { MobileBottomNav } from "@/components/responsive/MobileBottomNav";
import { menus } from "@/config/menus";
import { Lock, LogOut, Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import logo from "@/assets/vitaluxe-logo-dark-bg.png";

export function AppSidebar() {
  const { state } = useSidebar();
  const { effectiveRole, isProviderAccount, isStaffAccount, signOut } = useAuth();
  const { isSubscribed } = useSubscription();
  const { isMobile } = useResponsive();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const roleMenus = effectiveRole 
    ? (isStaffAccount ? menus.staff : menus[effectiveRole]) || []
    : [];

  // Flatten for mobile nav
  const items = roleMenus.flatMap(section => 
    section.items.map(item => ({
      title: item.label,
      url: item.href,
      icon: item.icon,
      isPro: item.isPro || false,
    }))
  );

  const isCollapsed = state === "collapsed";

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-sidebar-accent text-primary font-medium glow-gold"
      : "hover:bg-sidebar-accent/50";

  // Mobile view - use bottom navigation
  if (isMobile) {
    return (
      <MobileBottomNav 
        items={items}
        maxVisibleItems={4}
      />
    );
  }

  // Desktop/Tablet view - use sidebar

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-center p-4 lg:p-6">
          <img 
            src={logo} 
            alt="Vitaluxe Services" 
            className={`transition-all duration-200 ${
              isCollapsed ? "h-8 sm:h-10" : "h-10 sm:h-12 md:h-14"
            }`}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {roleMenus.map((section) => (
          <SidebarGroup key={section.title}>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-primary font-semibold">
                {section.title}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isPro = item.isPro;
                  const isLocked = isPro && !isSubscribed && !isProviderAccount;
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.href}>
                      {isLocked ? (
                        <button
                          onClick={() => setShowUpgradeDialog(true)}
                          className={`flex w-full items-center rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent/50 text-sidebar-foreground/50 cursor-pointer min-h-[44px]`}
                        >
                          <Icon className="h-4 w-4" />
                          {!isCollapsed && <span className="ml-3">{item.label}</span>}
                          {!isCollapsed && <Lock className="ml-auto h-3 w-3" />}
                        </button>
                      ) : (
                        <SidebarMenuButton asChild className="min-h-[44px]">
                          <NavLink to={item.href} className={getNavCls}>
                            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                            {!isCollapsed && <span className="ml-3 text-sm sm:text-base">{item.label}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <div className="mt-auto border-t border-sidebar-border p-4 space-y-2">
        {!isSubscribed && effectiveRole === 'doctor' && !isStaffAccount && (
          <Button
            onClick={() => setShowUpgradeDialog(true)}
            className="w-full justify-start bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
          >
            <Sparkles className="h-5 w-5" />
            {!isCollapsed && <span className="ml-2 text-sm">Upgrade to Pro</span>}
          </Button>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={signOut}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
      <UpgradeDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog} />
    </Sidebar>
  );
}
