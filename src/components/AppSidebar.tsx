import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { NavLink, useLocation } from "react-router-dom";
import { UpgradeDialog } from "@/components/subscription/UpgradeDialog";
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
  Sparkles,
  Calendar,
  CreditCard,
  Lock,
  Inbox,
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
    { title: "Representatives", url: "/representatives", icon: Users },
    { title: "Patients", url: "/patients", icon: Users },
    { title: "Products", url: "/products", icon: Package },
    { title: "Pharmacies", url: "/pharmacies", icon: Building2 },
    { title: "Orders", url: "/orders", icon: ShoppingCart },
    { title: "Reports", url: "/reports", icon: FileText },
    { title: "Rep Productivity", url: "/rep-productivity", icon: UserCog },
    { title: "Discount Codes", url: "/admin/discount-codes", icon: Tag },
    { title: "Subscriptions", url: "/subscriptions", icon: CreditCard },
    { title: "Messages", url: "/messages", icon: MessageSquare },
    { title: "Security", url: "/security", icon: Shield },
    { title: "Terms Management", url: "/admin/terms", icon: FileText },
    { title: "Admin Settings", url: "/admin-settings", icon: Settings },
  ],
  doctor: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Products", url: "/products", icon: Package },
    { title: "My Cart", url: "/cart", icon: ShoppingCart },
    { title: "Patients", url: "/patients", icon: Users },
    { title: "Providers", url: "/providers", icon: UserCog },
    { title: "My Orders", url: "/orders", icon: FileText },
    { title: "Reports", url: "/reports", icon: FileText },
    { title: "Messages", url: "/messages", icon: MessageSquare },
    { title: "My Profile", url: "/profile", icon: UserCircle },
    { title: "PRO_SEPARATOR", url: "", icon: null, isPro: false },
    { title: "My Staff", url: "/staff", icon: Users, isPro: true },
    { title: "Practice Calendar", url: "/practice-calendar", icon: Calendar, isPro: true },
    { title: "Documents & Forms", url: "/documents-and-forms", icon: FileText, isPro: true },
    { title: "Triage Center", url: "/triage-queue", icon: AlertCircle, isPro: true },
    { title: "My Subscription", url: "/my-subscription", icon: CreditCard, isPro: true },
  ],
  provider: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Products", url: "/products", icon: Package },
    { title: "My Cart", url: "/cart", icon: ShoppingCart },
    { title: "Patients", url: "/patients", icon: Users },
    { title: "My Orders", url: "/orders", icon: FileText },
    { title: "Messages", url: "/messages", icon: MessageSquare },
    { title: "My Profile", url: "/profile", icon: UserCircle },
    { title: "PRO_SEPARATOR", url: "", icon: null, isPro: false },
    { title: "Practice Calendar", url: "/practice-calendar", icon: Calendar, isPro: true },
    { title: "Documents & Forms", url: "/documents-and-forms", icon: FileText, isPro: true },
    { title: "Triage Center", url: "/triage-queue", icon: AlertCircle, isPro: true },
  ],
  pharmacy: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Products", url: "/products", icon: Pill },
    { title: "Shipping", url: "/shipping", icon: Package },
    { title: "Orders", url: "/orders", icon: ShoppingCart },
    { title: "Reports", url: "/reports", icon: FileText },
    { title: "Messages", url: "/messages", icon: MessageSquare },
  ],
  topline: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Products", url: "/products", icon: Package },
    { title: "My Practices", url: "/practices", icon: Stethoscope },
    { title: "My Downlines", url: "/downlines", icon: Users },
    { title: "Downline Performance", url: "/downline-performance", icon: UserCog },
    { title: "Orders", url: "/orders", icon: ShoppingCart },
    { title: "Reports", url: "/reports", icon: FileText },
    { title: "Messages", url: "/messages", icon: MessageSquare },
    { title: "Profile", url: "/profile", icon: UserCircle },
  ],
  downline: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Products", url: "/products", icon: Package },
    { title: "My Practices", url: "/practices", icon: Stethoscope },
    { title: "Orders", url: "/orders", icon: ShoppingCart },
    { title: "Reports", url: "/reports", icon: FileText },
    { title: "Messages", url: "/messages", icon: MessageSquare },
    { title: "Profile", url: "/profile", icon: UserCircle },
  ],
  patient: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "My Appointments", url: "/appointments", icon: Calendar },
    { title: "Medical Vault", url: "/medical-vault", icon: FileText },
    { title: "Documents", url: "/documents", icon: FileText },
    { title: "Messages", url: "/messages", icon: MessageSquare },
    { title: "My Profile", url: "/profile", icon: UserCircle },
  ],
};

export function AppSidebar() {
  const { state } = useSidebar();
  const { effectiveRole, isImpersonating, isProviderAccount, signOut } = useAuth();
  const { isSubscribed } = useSubscription();
  const location = useLocation();
  const currentPath = location.pathname;
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

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
              {items.map((item: any) => {
                if (item.title === "PRO_SEPARATOR") {
                  return (
                    <div key="pro-separator" className="px-3 py-3 mt-4">
                      <div className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">
                        Pro Features
                      </div>
                    </div>
                  );
                }
                const isProFeature = item.isPro && !isSubscribed;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className="min-h-[44px]">
                      <NavLink 
                        to={item.url} 
                        end 
                        className={({ isActive }) => {
                          const baseClass = getNavCls({ isActive });
                          return isProFeature 
                            ? `${baseClass} opacity-60` 
                            : baseClass;
                        }}
                      >
                        <item.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                        {!isCollapsed && (
                          <span className="text-sm sm:text-base flex items-center gap-2 flex-1">
                            {item.title}
                            {item.isPro && !isSubscribed && (
                              <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
                            )}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto border-t border-sidebar-border p-4 space-y-2">
        {!isSubscribed && effectiveRole === 'doctor' && !isProviderAccount && (
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
