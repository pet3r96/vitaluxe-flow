import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { NavLink, useLocation } from "react-router-dom";
import { UpgradeDialog } from "@/components/subscription/UpgradeDialog";
import { useResponsive } from "@/hooks/use-mobile";
import { MobileMenuNav } from "@/components/responsive/MobileMenuNav";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { FlyoutMenu } from "@/components/layout/FlyoutMenu";
import { menus } from "@/config/menus";
import { Lock, LogOut, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logoDark from "@/assets/vitaluxe-logo-dark-bg.png";
import logoLight from "@/assets/vitaluxe-logo-light.png";

export function AppSidebar() {
  const { state } = useSidebar();
  const { theme } = useTheme();
  const location = useLocation();
  const { effectiveRole, isProviderAccount, isStaffAccount, signOut } = useAuth();
  const { isSubscribed } = useSubscription();
  const { isMobile } = useResponsive();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [hoveredParent, setHoveredParent] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<string[]>([]);

  // Determine which logo to use based on theme (default to dark)
  const currentLogo = theme === "light" ? logoLight : logoDark;
  const isCollapsed = state === "collapsed";

  // Filter menu items based on role
  const filterMenuItems = (items: any[]) => {
    return items.filter(item => {
      if (isStaffAccount && item.hideForStaff) return false;
      if (isProviderAccount && item.hideForProvider) return false;
      return true;
    });
  };

  const roleMenus = effectiveRole 
    ? (isStaffAccount ? menus.staff : menus[effectiveRole]) || []
    : [];

  // Apply role-based filtering to menu sections
  const filteredMenus = roleMenus.map(section => ({
    ...section,
    items: filterMenuItems(section.items)
  })).filter(section => section.items.length > 0);

  // Flatten for mobile nav
  const items = filteredMenus.flatMap(section => 
    section.items.map(item => ({
      title: item.label,
      url: item.href,
      icon: item.icon,
      isPro: item.isPro || false,
    }))
  );

  const isRouteActive = (href: string) => location.pathname === href;
  const hasActiveChild = (items: { href: string }[]) =>
    items.some((item) => isRouteActive(item.href));

  const toggleSection = (title: string) => {
    setOpenSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  // Initialize open sections for those with active children (only once on mount)
  useEffect(() => {
    if (openSections.length === 0) {
      const initialOpen = filteredMenus
        .filter((section) => section.isParent && hasActiveChild(section.items))
        .map((section) => section.title);
      if (initialOpen.length > 0) {
        setOpenSections(initialOpen);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mobile view - use hamburger menu (but NOT for patients - they have PatientMobileHeader)
  if (isMobile && effectiveRole !== 'patient') {
    // Transform sections to match MobileMenuNav expected format
    const mobileSections = filteredMenus.map(section => ({
      title: section.title,
      items: section.items.map(item => ({
        title: item.label,
        url: item.href,
        icon: item.icon,
        isPro: item.isPro || false,
      }))
    }));

    return (
      <>
        <MobileMenuNav 
          items={items}
          sections={mobileSections}
          isSubscribed={isSubscribed}
          effectiveRole={effectiveRole || ''}
          isStaffAccount={isStaffAccount}
          onSignOut={signOut}
          onUpgrade={() => setShowUpgradeDialog(true)}
        />
        <UpgradeDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog} />
      </>
    );
  }

  // Use AdminSidebar for admin role
  if (effectiveRole === "admin") {
    return <AdminSidebar />;
  }

  // Desktop/Tablet view - use sidebar for other roles
  return (
    <Sidebar
      className={cn(
        "transition-all duration-200",
        isCollapsed ? "w-20" : "w-64",
        theme === "light"
          ? "bg-gradient-to-b from-[#FDFBF7] to-[#FAF6F0]"
          : "bg-[#0D0D0F]"
      )}
      collapsible="icon"
    >
      <SidebarHeader className="border-b border-sidebar-border">
        <div className={cn(
          "flex items-center justify-center py-4",
          isCollapsed ? "px-1" : "px-4"
        )}>
          <img
            src={currentLogo}
            alt="Vitaluxe Services"
            className={cn(
              "object-contain transition-all duration-200",
              isCollapsed
                ? "w-12 h-12"
                : "max-w-full w-auto h-16"
            )}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {filteredMenus.map((section) => {
          const isActive = hasActiveChild(section.items);
          const isSectionOpen = openSections.includes(section.title);
          const SectionIcon = section.icon;

          // Direct link sections (no parent)
          if (!section.isParent) {
            return (
              <SidebarGroup key={section.title}>
                {!isCollapsed && (
                  <SidebarGroupLabel className="text-xs uppercase font-semibold text-gray-700 dark:text-gray-300 tracking-wider px-3">
                    {section.title}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isPro = item.isPro;
                      const isLocked = isPro && !isSubscribed && !isProviderAccount;

                      return (
                        <SidebarMenuItem key={item.href}>
                          {isLocked ? (
                            <button
                              onClick={() => setShowUpgradeDialog(true)}
                              className={cn(
                                "flex w-full items-center gap-3 py-2.5 rounded-md text-sm hover:bg-sidebar-accent/50 text-gray-500 dark:text-gray-400 cursor-pointer min-h-[44px] px-3"
                              )}
                            >
                              <Icon className="h-5 w-5 shrink-0" />
                              {!isCollapsed && <span>{item.label}</span>}
                              {!isCollapsed && <Lock className="h-3 w-3 ml-2 opacity-70" />}
                            </button>
                          ) : (
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={item.href}
                                end
                                className={({ isActive }) =>
                                  cn(
                                    "flex items-center gap-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 min-h-[44px] border-l-4",
                                    isActive
                                      ? "bg-card border-gold1 text-gold1 font-semibold pl-[8px] pr-3"
                                      : "text-gray-700 dark:text-gray-300 hover:text-gold2 hover:bg-muted/10 border-transparent px-3"
                                  )
                                }
                              >
                                <Icon className="h-5 w-5 shrink-0" />
                                {!isCollapsed && <span>{item.label}</span>}
                              </NavLink>
                            </SidebarMenuButton>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          // Parent sections with submenu
          if (isCollapsed) {
            // Collapsed state: Show flyout on hover
            return (
              <SidebarGroup key={section.title}>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem
                      className="relative"
                      onMouseEnter={() => setHoveredParent(section.title)}
                      onMouseLeave={() => setHoveredParent(null)}
                    >
                      <SidebarMenuButton
                        className={cn(
                          "flex items-center justify-center p-3 rounded-md transition-all duration-200 min-h-[44px]",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-gray-700 dark:text-gray-300 hover:bg-sidebar-accent/50"
                        )}
                      >
                        {SectionIcon && <SectionIcon className="h-5 w-5" />}
                      </SidebarMenuButton>
                      <FlyoutMenu
                        items={section.items}
                        isVisible={hoveredParent === section.title}
                        onItemClick={() => setHoveredParent(null)}
                        isSubscribed={isSubscribed}
                        isProviderAccount={isProviderAccount}
                        onUpgrade={() => setShowUpgradeDialog(true)}
                      />
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          // Expanded state: Show inline collapsible menu
          return (
            <SidebarGroup key={section.title}>
              <Collapsible
                open={isSectionOpen}
                onOpenChange={() => toggleSection(section.title)}
              >
                <SidebarGroupLabel className="p-0">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-3 px-3 py-2.5 h-auto min-h-[44px] text-xs uppercase font-semibold tracking-wider hover:bg-sidebar-accent/50",
                        isActive ? "text-primary" : "text-gray-700 dark:text-gray-300"
                      )}
                    >
                      {SectionIcon && <SectionIcon className="h-4 w-4" />}
                      <span className="flex-1 text-left">{section.title}</span>
                      {isSectionOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-4">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isPro = item.isPro;
                        const isLocked = isPro && !isSubscribed && !isProviderAccount;

                        return (
                          <SidebarMenuItem key={item.href}>
                            {isLocked ? (
                              <button
                                onClick={() => setShowUpgradeDialog(true)}
                                className={cn(
                                  "flex w-full items-center gap-3 py-2.5 rounded-md text-sm hover:bg-sidebar-accent/50 text-gray-500 dark:text-gray-400 cursor-pointer min-h-[44px] px-3"
                                )}
                              >
                                <Icon className="h-5 w-5 shrink-0" />
                                <span>{item.label}</span>
                                <Lock className="h-3 w-3 ml-2 opacity-70" />
                              </button>
                            ) : (
                              <SidebarMenuButton asChild>
                                <NavLink
                                  to={item.href}
                                  end
                                  className={({ isActive }) =>
                                    cn(
                                      "flex items-center gap-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 min-h-[44px] border-l-4",
                                      isActive
                                        ? "bg-card border-gold1 text-gold1 font-semibold pl-[8px] pr-3"
                                        : "text-gray-700 dark:text-gray-300 hover:text-gold2 hover:bg-muted/10 border-transparent px-3"
                                    )
                                  }
                                >
                                  <Icon className="h-5 w-5 shrink-0" />
                                  <span>{item.label}</span>
                                </NavLink>
                              </SidebarMenuButton>
                            )}
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {!isSubscribed && effectiveRole === 'doctor' && !isStaffAccount && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Button
                  onClick={() => setShowUpgradeDialog(true)}
                  className="w-full justify-start gap-3 bg-gold-gradient hover:opacity-90 text-white font-semibold min-h-[44px]"
                >
                  <Sparkles className="h-5 w-5" />
                  {!isCollapsed && <span>Upgrade to Pro</span>}
                </Button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button
                variant="ghost"
                onClick={signOut}
                className="w-full justify-start gap-3 text-gray-700 dark:text-gray-300 hover:bg-sidebar-accent/50 min-h-[44px]"
              >
                <LogOut className="h-5 w-5" />
                {!isCollapsed && <span>Sign Out</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <UpgradeDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog} />
    </Sidebar>
  );
}
