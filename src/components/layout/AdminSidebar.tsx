import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { menus } from "@/config/menus";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { FlyoutMenu } from "./FlyoutMenu";
import logoLight from "@/assets/vitaluxe-logo-light.png";
import logoDark from "@/assets/vitaluxe-logo-dark-bg.png";

export function AdminSidebar() {
  const [hoveredParent, setHoveredParent] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const { state } = useSidebar();
  const location = useLocation();
  const { theme } = useTheme();
  const { signOut } = useAuth();
  
  const isCollapsed = state === "collapsed";
  const adminMenus = menus.admin || [];
  const currentLogo = theme === "light" ? logoLight : logoDark;

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
    // Only initialize if no sections are manually opened yet
    if (openSections.length === 0) {
      const initialOpen = adminMenus
        .filter((section) => section.isParent && hasActiveChild(section.items))
        .map((section) => section.title);
      if (initialOpen.length > 0) {
        setOpenSections(initialOpen);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

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
                ? "max-w-[56px] max-h-[56px] w-auto h-auto"
                : "max-w-full w-auto h-16"
            )}
            style={isCollapsed ? { maxWidth: '56px', maxHeight: '56px' } : undefined}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {adminMenus.map((section) => {
          const isActive = hasActiveChild(section.items);
          const isSectionOpen = openSections.includes(section.title);
          const SectionIcon = section.icon;

          // Direct link sections (no parent)
          if (!section.isParent) {
            return (
              <SidebarGroup key={section.title}>
                {!isCollapsed && (
                  <SidebarGroupLabel className="text-xs uppercase font-semibold text-muted-foreground tracking-wider px-3">
                    {section.title}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.href}
                              end
                              className={({ isActive }) =>
                                cn(
                                  "flex items-center gap-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 min-h-[44px] border-l-4",
                                  isActive
                                ? "bg-card border-gold1 text-gold1 font-semibold pl-[8px] pr-3"
                                    : "text-sidebar-foreground hover:text-gold2 hover:bg-muted/10 border-transparent px-3"
                                )
                              }
                            >
                              <Icon className="h-5 w-5 shrink-0" />
                              {!isCollapsed && <span>{item.label}</span>}
                            </NavLink>
                          </SidebarMenuButton>
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
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        {SectionIcon && <SectionIcon className="h-5 w-5" />}
                      </SidebarMenuButton>
                      <FlyoutMenu
                        items={section.items}
                        isVisible={hoveredParent === section.title}
                        onItemClick={() => setHoveredParent(null)}
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
                        isActive ? "text-primary" : "text-muted-foreground"
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
                        return (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={item.href}
                                end
                                className={({ isActive }) =>
                                  cn(
                                    "flex items-center gap-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 min-h-[44px] border-l-4",
                                    isActive
                                      ? "bg-card border-gold1 text-gold1 font-semibold pl-[8px] pr-3"
                                      : "text-sidebar-foreground hover:text-gold2 hover:bg-muted/10 border-transparent px-3"
                                  )
                                }
                              >
                                <Icon className="h-5 w-5 shrink-0" />
                                <span>{item.label}</span>
                              </NavLink>
                            </SidebarMenuButton>
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
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50 min-h-[44px]"
              >
                <LogOut className="h-5 w-5" />
                {!isCollapsed && <span>Sign Out</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
