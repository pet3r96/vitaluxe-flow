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
  AlertCircle,
  Tag,
  Shield,
  Pill,
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
    { title: "Accounts", url: "/dashboard/accounts", icon: Users },
    { title: "Practices", url: "/dashboard/practices", icon: Stethoscope },
    { title: "Patients", url: "/dashboard/patients", icon: Users },
    { title: "Products", url: "/dashboard/products", icon: Package },
    { title: "Pharmacies", url: "/dashboard/pharmacies", icon: Building2 },
    { title: "Orders", url: "/dashboard/orders", icon: ShoppingCart },
    { title: "Reports", url: "/dashboard/reports", icon: FileText },
    { title: "Discount Codes", url: "/dashboard/admin/discount-codes", icon: Tag },
    { title: "Messages", url: "/dashboard/messages", icon: MessageSquare },
    { title: "Security", url: "/dashboard/security", icon: Shield },
    { title: "Terms Management", url: "/dashboard/admin/terms", icon: FileText },
    { title: "Admin Settings", url: "/dashboard/admin-settings", icon: Settings },
  ],
  doctor: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Patients", url: "/dashboard/patients", icon: Users },
    { title: "Providers", url: "/dashboard/providers", icon: UserCog },
    { title: "Products", url: "/dashboard/products", icon: Package },
    { title: "My Cart", url: "/dashboard/cart", icon: ShoppingCart },
    { title: "My Orders", url: "/dashboard/orders", icon: FileText },
    { title: "Reports", url: "/dashboard/reports", icon: FileText },
    { title: "My Profile", url: "/dashboard/profile", icon: UserCircle },
    { title: "Messages", url: "/dashboard/messages", icon: MessageSquare },
  ],
  provider: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Patients", url: "/dashboard/patients", icon: Users },
    { title: "Products", url: "/dashboard/products", icon: Package },
    { title: "My Cart", url: "/dashboard/cart", icon: ShoppingCart },
    { title: "My Orders", url: "/dashboard/orders", icon: FileText },
    { title: "My Profile", url: "/dashboard/profile", icon: UserCircle },
    { title: "Messages", url: "/dashboard/messages", icon: MessageSquare },
  ],
  pharmacy: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Orders", url: "/dashboard/orders", icon: ShoppingCart },
    { title: "Reports", url: "/dashboard/reports", icon: FileText },
    { title: "Messages", url: "/dashboard/messages", icon: MessageSquare },
  ],
  topline: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Practices", url: "/dashboard/practices", icon: Stethoscope },
    { title: "Products", url: "/dashboard/products", icon: Package },
    { title: "My Downlines", url: "/dashboard/downlines", icon: Users },
    { title: "Orders", url: "/dashboard/orders", icon: ShoppingCart },
    { title: "Reports", url: "/dashboard/reports", icon: FileText },
    { title: "Messages", url: "/dashboard/messages", icon: MessageSquare },
    { title: "Profile", url: "/dashboard/profile", icon: UserCircle },
  ],
  downline: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Practices", url: "/dashboard/practices", icon: Stethoscope },
    { title: "Products", url: "/dashboard/products", icon: Package },
    { title: "Orders", url: "/dashboard/orders", icon: ShoppingCart },
    { title: "Reports", url: "/dashboard/reports", icon: FileText },
    { title: "Messages", url: "/dashboard/messages", icon: MessageSquare },
    { title: "Profile", url: "/dashboard/profile", icon: UserCircle },
  ],
};

export function AppSidebar() {
  const { state } = useSidebar();
  const { effectiveRole, isImpersonating, isProviderAccount, signOut } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  let items = effectiveRole ? menuItems[effectiveRole as keyof typeof menuItems] || [] : [];
  
  // Hide "Providers" and "Reports" tabs for provider accounts
  if (effectiveRole === 'doctor' && isProviderAccount) {
    items = items.filter(item => 
      item.title !== "Providers" && item.title !== "Reports"
    );
  }
  
  const isCollapsed = state === "collapsed";

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-sidebar-accent text-primary font-medium glow-gold"
      : "hover:bg-sidebar-accent/50";

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
                  <SidebarMenuButton asChild className="min-h-[44px]">
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                      {!isCollapsed && <span className="text-sm sm:text-base">{item.title}</span>}
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
