import { useAuth } from "@/contexts/AuthContext";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  Building2,
  ShoppingCart,
  FileText,
  MessageSquare,
  LogOut,
  Stethoscope,
  UserCircle,
  Settings,
  ShieldCheck,
  UserCog,
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
import logo from "@/assets/vitaluxe-logo-dark-bg.png";

const menuItems = {
  admin: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Accounts", url: "/accounts", icon: Users },
    { title: "Practices", url: "/practices", icon: Stethoscope },
    { title: "Patients", url: "/patients", icon: Users },
    { title: "Products", url: "/products", icon: Package },
    { title: "Pharmacies", url: "/pharmacies", icon: Building2 },
    { title: "Orders", url: "/orders", icon: ShoppingCart },
    { title: "Reports", url: "/reports", icon: FileText },
    { title: "Messages", url: "/messages", icon: MessageSquare },
    { title: "Admin Settings", url: "/admin-settings", icon: ShieldCheck },
  ],
  doctor: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Patients", url: "/patients", icon: Users },
    { title: "Providers", url: "/providers", icon: UserCog },
    { title: "Products", url: "/products", icon: Package },
    { title: "My Cart", url: "/cart", icon: ShoppingCart },
    { title: "My Orders", url: "/orders", icon: FileText },
    { title: "My Profile", url: "/profile", icon: UserCircle },
    { title: "Messages", url: "/messages", icon: MessageSquare },
  ],
  provider: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Patients", url: "/patients", icon: Users },
    { title: "Products", url: "/products", icon: Package },
    { title: "My Cart", url: "/cart", icon: ShoppingCart },
    { title: "My Orders", url: "/orders", icon: FileText },
    { title: "Messages", url: "/messages", icon: MessageSquare },
  ],
  pharmacy: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Orders", url: "/orders", icon: ShoppingCart },
    { title: "Reports", url: "/reports", icon: FileText },
  ],
  topline: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "My Downlines", url: "/downlines", icon: Users },
    { title: "Reports", url: "/reports", icon: FileText },
  ],
  downline: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Med Spas", url: "/med-spas", icon: Building2 },
    { title: "Reports", url: "/reports", icon: FileText },
  ],
};

export function AppSidebar() {
  const { state } = useSidebar();
  const { effectiveRole, isImpersonating, signOut } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  const items = effectiveRole ? menuItems[effectiveRole as keyof typeof menuItems] || [] : [];
  const isCollapsed = state === "collapsed";

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-sidebar-accent text-primary font-medium glow-gold"
      : "hover:bg-sidebar-accent/50";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-center p-4">
          <img 
            src={logo} 
            alt="Vitaluxe Services" 
            className={`transition-all duration-200 ${isCollapsed ? "h-8" : "h-12"}`}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-primary font-semibold">
              {isImpersonating ? "Impersonated View" : "Main Menu"}
            </SidebarGroupLabel>
          )}

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="h-5 w-5" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto border-t border-sidebar-border p-4">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={signOut}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </Sidebar>
  );
}
