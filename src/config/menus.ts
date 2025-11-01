import { LucideIcon, LayoutDashboard, Users, Stethoscope, Building2, ShoppingCart, FileText, BarChart3, Package, MessageSquare, CreditCard, Tag, Shield, Pill, Activity, Calendar, FolderOpen, UserCog, Settings, ClipboardList, Heart, TrendingUp, Bell } from "lucide-react";

export interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isPro?: boolean;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

export type MenuConfig = {
  [role: string]: MenuItem[] | MenuSection[];
};

export const menus: MenuConfig = {
  admin: [
    {
      title: "Dashboard",
      items: [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }
      ]
    },
    {
      title: "User Management",
      items: [
        { title: "Accounts", url: "/accounts", icon: Users },
        { title: "Practices", url: "/practices", icon: Stethoscope },
        { title: "Representatives", url: "/representatives", icon: Users },
        { title: "Patients", url: "/patients", icon: Users },
        { title: "Pharmacies", url: "/pharmacies", icon: Building2 }
      ]
    },
    {
      title: "Orders & Reporting",
      items: [
        { title: "Orders", url: "/orders", icon: ShoppingCart },
        { title: "Reports", url: "/reports", icon: FileText },
        { title: "Rep Productivity", url: "/rep-productivity", icon: BarChart3 }
      ]
    },
    {
      title: "Products",
      items: [
        { title: "Product Catalog", url: "/products", icon: Package }
      ]
    },
    {
      title: "Communications",
      items: [
        { title: "Messages", url: "/messages", icon: MessageSquare }
      ]
    },
    {
      title: "Order Management",
      items: [
        { title: "Subscriptions", url: "/subscriptions", icon: CreditCard },
        { title: "Discount Codes", url: "/admin/discount-codes", icon: Tag }
      ]
    },
    {
      title: "Admin Settings",
      items: [
        { title: "Security", url: "/security", icon: Shield },
        { title: "Terms Management", url: "/admin/terms", icon: FileText }
      ]
    }
  ] as MenuSection[],
  
  doctor: [
    { title: "Dashboard", url: "/doctor/dashboard", icon: LayoutDashboard },
    { title: "Patients", url: "/doctor/patients", icon: Users },
    { title: "Appointments", url: "/doctor/appointments", icon: Calendar },
    { title: "Prescriptions", url: "/doctor/prescriptions", icon: Pill },
    { title: "Messages", url: "/doctor/messages", icon: MessageSquare },
    { title: "Settings", url: "/doctor/settings", icon: Settings }
  ] as MenuItem[],
  
  provider: [
    { title: "Dashboard", url: "/provider/dashboard", icon: LayoutDashboard },
    { title: "Appointments", url: "/provider/appointments", icon: Calendar },
    { title: "Patients", url: "/provider/patients", icon: Users },
    { title: "Messages", url: "/provider/messages", icon: MessageSquare },
    { title: "Settings", url: "/provider/settings", icon: Settings }
  ] as MenuItem[],
  
  pharmacy: [
    { title: "Dashboard", url: "/pharmacy/dashboard", icon: LayoutDashboard },
    { title: "Orders", url: "/pharmacy/orders", icon: ShoppingCart },
    { title: "Inventory", url: "/pharmacy/inventory", icon: Package },
    { title: "Patients", url: "/pharmacy/patients", icon: Users },
    { title: "Messages", url: "/pharmacy/messages", icon: MessageSquare },
    { title: "Reports", url: "/pharmacy/reports", icon: FileText },
    { title: "Settings", url: "/pharmacy/settings", icon: Settings }
  ] as MenuItem[],
  
  topline: [
    { title: "Dashboard", url: "/topline/dashboard", icon: LayoutDashboard },
    { title: "Team", url: "/topline/team", icon: Users },
    { title: "Orders", url: "/topline/orders", icon: ShoppingCart },
    { title: "Reports", url: "/topline/reports", icon: BarChart3 },
    { title: "Messages", url: "/topline/messages", icon: MessageSquare },
    { title: "Settings", url: "/topline/settings", icon: Settings }
  ] as MenuItem[],
  
  downline: [
    { title: "Dashboard", url: "/downline/dashboard", icon: LayoutDashboard },
    { title: "Orders", url: "/downline/orders", icon: ShoppingCart },
    { title: "Clients", url: "/downline/clients", icon: Users },
    { title: "Reports", url: "/downline/reports", icon: BarChart3 },
    { title: "Messages", url: "/downline/messages", icon: MessageSquare },
    { title: "Settings", url: "/downline/settings", icon: Settings }
  ] as MenuItem[],
  
  patient: [
    { title: "Dashboard", url: "/patient/dashboard", icon: LayoutDashboard },
    { title: "Appointments", url: "/patient/appointments", icon: Calendar },
    { title: "Medical Vault", url: "/patient/medical-vault", icon: FolderOpen },
    { title: "Orders", url: "/patient/orders", icon: ShoppingCart },
    { title: "Messages", url: "/patient/messages", icon: MessageSquare },
    { title: "Profile", url: "/patient/profile", icon: UserCog }
  ] as MenuItem[],
  
  staff: [
    { title: "Dashboard", url: "/staff/dashboard", icon: LayoutDashboard },
    { title: "Patients", url: "/staff/patients", icon: Users },
    { title: "Appointments", url: "/staff/appointments", icon: Calendar },
    { title: "Tasks", url: "/staff/tasks", icon: ClipboardList },
    { title: "Messages", url: "/staff/messages", icon: MessageSquare },
    { title: "Settings", url: "/staff/settings", icon: Settings }
  ] as MenuItem[],
  
  default: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Settings", url: "/settings", icon: Settings }
  ] as MenuItem[]
};

// Helper function to check if menu has sections
export const hasMenuSections = (menu: MenuItem[] | MenuSection[]): menu is MenuSection[] => {
  return menu.length > 0 && 'items' in menu[0];
};

// Helper function to get flat menu items from sections
export const getFlatMenuItems = (menu: MenuItem[] | MenuSection[]): MenuItem[] => {
  if (hasMenuSections(menu)) {
    return menu.flatMap(section => section.items);
  }
  return menu;
};
