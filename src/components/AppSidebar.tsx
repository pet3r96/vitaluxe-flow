import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { NavLink, useLocation } from "react-router-dom";
import { UpgradeDialog } from "@/components/subscription/UpgradeDialog";
import { useResponsive } from "@/hooks/use-mobile";
import { MobileBottomNav } from "@/components/responsive/MobileBottomNav";
import { menus, hasMenuSections } from "@/config/menus";
import {
  LogOut,
  Sparkles,
  Lock,
} from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import logo from "@/assets/vitaluxe-logo-dark-bg.png";

export function AppSidebar() {
  const { state } = useSidebar();
  const { effectiveRole, isImpersonating, isProviderAccount, isStaffAccount, signOut } = useAuth();
  const { isSubscribed } = useSubscription();
  const location = useLocation();
  const currentPath = location.pathname;
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const { isMobile, isTablet } = useResponsive();

  // Get menu for current role from config
  const roleMenu = menus[effectiveRole || 'default'] || menus.default;
  const hasGroupedMenu = hasMenuSections(roleMenu);
  
  const isCollapsed = state === "collapsed";

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-sidebar-accent text-primary font-medium active-indicator"
      : "hover:bg-sidebar-accent/50 transition-smooth hover-glow";

  // Mobile view - use bottom navigation
  if (isMobile) {
    // Flatten menu items for mobile nav
    const flatItems = hasGroupedMenu 
      ? roleMenu.flatMap((section: any) => section.items)
      : roleMenu;
    
    return (
      <MobileBottomNav 
        items={flatItems
          .filter((item: any) => item.url && item.title !== 'PRO_SEPARATOR')
          .map((item: any) => ({
            title: item.title,
            url: item.url,
            icon: item.icon,
            isPro: item.isPro || false
          }))}
        maxVisibleItems={4}
      />
    );
  }

  // Desktop/Tablet view - use sidebar
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-center p-4 lg:p-6">
          <img 
            src={logo} 
            alt="Vitaluxe Services" 
            className={`transition-all duration-300 ${
              isCollapsed ? "h-8 sm:h-10" : "h-10 sm:h-12 md:h-14"
            }`}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {hasGroupedMenu ? (
          // Render grouped menu (Admin)
          roleMenu.map((section: any, idx: number) => (
            <SidebarGroup key={section.title}>
              {!isCollapsed && (
                <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground font-heading">
                  {section.title}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item: any) => {
                    const isProFeature = item.isPro && !isSubscribed && !isStaffAccount;
                    const Icon = item.icon;
                    
                    return (
                      <SidebarMenuItem key={item.title}>
                        <TooltipProvider>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <SidebarMenuButton asChild className="min-h-[44px]">
                                <NavLink 
                                  to={item.url} 
                                  end 
                                  className={({ isActive }) => {
                                    const baseClass = getNavCls({ isActive });
                                    return isProFeature 
                                      ? `${baseClass} opacity-60 cursor-not-allowed` 
                                      : baseClass;
                                  }}
                                  onClick={(e) => isProFeature && e.preventDefault()}
                                >
                                  <Icon className="h-5 w-5" />
                                  {!isCollapsed && (
                                    <span className="text-sm flex items-center gap-2 flex-1">
                                      {item.title}
                                      {item.isPro && !isSubscribed && !isStaffAccount && (
                                        <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
                                      )}
                                    </span>
                                  )}
                                </NavLink>
                              </SidebarMenuButton>
                            </TooltipTrigger>
                            {isCollapsed && (
                              <TooltipContent side="right">
                                <p>{item.title}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        ) : (
          // Render flat menu (other roles)
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {roleMenu.map((item: any) => {
                  if (item.title === "PRO_SEPARATOR") {
                    return (
                      <div key="pro-separator" className="px-3 py-3 mt-4">
                        <div className="text-xs font-semibold text-primary uppercase tracking-wider font-heading">
                          Pro Features
                        </div>
                      </div>
                    );
                  }
                  const isProFeature = item.isPro && !isSubscribed && !isStaffAccount;
                  const Icon = item.icon;
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton asChild className="min-h-[44px]">
                              <NavLink 
                                to={item.url} 
                                end 
                                className={({ isActive }) => {
                                  const baseClass = getNavCls({ isActive });
                                  return isProFeature 
                                    ? `${baseClass} opacity-60 cursor-not-allowed` 
                                    : baseClass;
                                }}
                                onClick={(e) => isProFeature && e.preventDefault()}
                              >
                                <Icon className="h-5 w-5" />
                                {!isCollapsed && (
                                  <span className="text-sm flex items-center gap-2 flex-1">
                                    {item.title}
                                    {item.isPro && !isSubscribed && !isStaffAccount && (
                                      <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
                                    )}
                                  </span>
                                )}
                              </NavLink>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right">
                              <p>{item.title}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <div className="mt-auto border-t border-sidebar-border p-4 space-y-2">
        {!isSubscribed && effectiveRole === 'doctor' && !isStaffAccount && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowUpgradeDialog(true)}
                  className="w-full justify-start bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold transition-smooth"
                >
                  <Sparkles className="h-5 w-5" />
                  {!isCollapsed && <span className="ml-2 text-sm">Upgrade to Pro</span>}
                </Button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>Upgrade to Pro</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 transition-smooth"
                onClick={signOut}
              >
                <LogOut className="h-5 w-5" />
                {!isCollapsed && <span className="ml-2">Sign Out</span>}
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">
                <p>Sign Out</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
      <UpgradeDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog} />
    </Sidebar>
  );
}
