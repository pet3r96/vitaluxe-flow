import { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Package,
  Building2,
  ShoppingCart,
  FileText,
  MessageSquare,
  Stethoscope,
  BarChart3,
  CreditCard,
  Tag,
  Shield,
  TrendingUp,
  TrendingDown,
  Calendar,
  ClipboardList,
  FileCheck,
  Inbox,
  UserRoundCog,
  Truck,
  Settings,
  Briefcase,
  UserSquare2,
  FileSignature,
  LifeBuoy,
} from "lucide-react";

export interface MenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
  isPro?: boolean;
  hideForStaff?: boolean;
  hideForProvider?: boolean;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
  isParent?: boolean;
  icon?: LucideIcon;
}

export type MenuConfig = {
  [role: string]: MenuSection[];
};

export const menus: MenuConfig = {
  admin: [
    {
      title: "Dashboard",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      title: "User Management",
      isParent: true,
      icon: Users,
      items: [
        { label: "All Users", href: "/accounts", icon: Users },
        { label: "Practices", href: "/practices", icon: Building2 },
        { label: "Representatives", href: "/representatives", icon: Briefcase },
        { label: "Patients", href: "/patients", icon: UserSquare2 },
        { label: "Pharmacies", href: "/pharmacies", icon: Stethoscope },
      ],
    },
    {
      title: "Orders & Reporting",
      isParent: true,
      icon: BarChart3,
      items: [
        { label: "Orders", href: "/orders", icon: ShoppingCart },
        { label: "Support", href: "/support", icon: LifeBuoy },
        { label: "Reports", href: "/reports", icon: FileText },
        { label: "Rep Productivity", href: "/rep-productivity", icon: BarChart3 },
        { label: "Product Catalog", href: "/products", icon: Package },
      ],
    },
    {
      title: "Settings",
      isParent: true,
      icon: Settings,
      items: [
        { label: "Admin Settings", href: "/admin-settings", icon: Settings },
        { label: "Security", href: "/security", icon: Shield },
        { label: "Terms Management", href: "/admin/terms", icon: FileSignature },
      ],
    },
  ],

  doctor: [
    {
      title: "Dashboard",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      title: "User Management",
      isParent: true,
      icon: Users,
      items: [
        { label: "Providers", href: "/providers", icon: UserRoundCog, hideForProvider: true },
        { label: "Patients", href: "/patients", icon: Users },
        { label: "Staff", href: "/staff", icon: Users, isPro: true },
        { label: "Practice Calendar", href: "/practice-calendar", icon: Calendar, isPro: true },
      ],
    },
    {
      title: "Orders & Reporting",
      isParent: true,
      icon: ShoppingCart,
      items: [
        { label: "Products", href: "/products", icon: Package },
        { label: "Orders", href: "/orders", icon: ShoppingCart },
        { label: "My Cart", href: "/cart", icon: ShoppingCart },
        { label: "Reporting", href: "/practice-reporting", icon: BarChart3, isPro: true, hideForStaff: true },
      ],
    },
    {
      title: "Communication",
      isParent: true,
      icon: MessageSquare,
      items: [
        { label: "Support", href: "/support", icon: LifeBuoy },
        { label: "Chat System", href: "/internal-chat", icon: MessageSquare, isPro: true },
        { label: "Document Center", href: "/document-center", icon: FileCheck, isPro: true },
      ],
    },
    {
      title: "Settings",
      isParent: true,
      icon: Settings,
      items: [
        { label: "My Profile", href: "/profile", icon: UserSquare2 },
        { label: "My Subscription", href: "/my-subscription", icon: CreditCard, isPro: true, hideForStaff: true, hideForProvider: true },
      ],
    },
  ],

  provider: [
    {
      title: "Dashboard",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      title: "User Management",
      isParent: true,
      icon: Users,
      items: [
        { label: "Providers", href: "/providers", icon: UserRoundCog, hideForProvider: true },
        { label: "Patients", href: "/patients", icon: Users },
        { label: "Staff", href: "/staff", icon: Users, isPro: true },
        { label: "Practice Calendar", href: "/practice-calendar", icon: Calendar, isPro: true },
      ],
    },
    {
      title: "Orders & Reporting",
      isParent: true,
      icon: ShoppingCart,
      items: [
        { label: "Products", href: "/products", icon: Package },
        { label: "Orders", href: "/orders", icon: ShoppingCart },
        { label: "My Cart", href: "/cart", icon: ShoppingCart },
        { label: "Reporting", href: "/practice-reporting", icon: BarChart3, isPro: true, hideForStaff: true },
      ],
    },
    {
      title: "Communication",
      isParent: true,
      icon: MessageSquare,
      items: [
        { label: "Support", href: "/support", icon: LifeBuoy },
        { label: "Chat System", href: "/internal-chat", icon: MessageSquare, isPro: true },
        { label: "Document Center", href: "/document-center", icon: FileCheck, isPro: true },
      ],
    },
    {
      title: "Settings",
      isParent: true,
      icon: Settings,
      items: [
        { label: "My Profile", href: "/profile", icon: UserSquare2 },
      ],
    },
  ],

  pharmacy: [
    {
      title: "Main Menu",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Orders", href: "/orders", icon: ShoppingCart },
        { label: "Shipping Management", href: "/shipping", icon: Truck },
        { label: "Messages", href: "/messages", icon: MessageSquare },
      ],
    },
  ],

  topline: [
    {
      title: "Main Menu",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Products", href: "/products", icon: Package },
        { label: "My Practices", href: "/practices", icon: Building2 },
        { label: "My Downlines", href: "/downlines", icon: TrendingDown },
        { label: "Reports", href: "/rep-reports", icon: BarChart3 },
        { label: "Messages", href: "/messages", icon: MessageSquare },
      ],
    },
  ],

  downline: [
    {
      title: "Main Menu",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Products", href: "/products", icon: Package },
        { label: "My Practices", href: "/practices", icon: Building2 },
        { label: "Reports", href: "/rep-reports", icon: BarChart3 },
        { label: "Messages", href: "/messages", icon: MessageSquare },
      ],
    },
  ],

  patient: [
    {
      title: "Main Menu",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Appointments", href: "/appointments", icon: Calendar },
        { label: "Medical Vault", href: "/medical-vault", icon: Shield },
        { label: "Documents", href: "/documents", icon: FileText },
        { label: "Messages", href: "/patient-messages", icon: MessageSquare },
      ],
    },
  ],

  staff: [
    {
      title: "Dashboard",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      title: "User Management",
      isParent: true,
      icon: Users,
      items: [
        { label: "Providers", href: "/providers", icon: UserRoundCog, hideForProvider: true },
        { label: "Patients", href: "/patients", icon: Users },
        { label: "Practice Calendar", href: "/practice-calendar", icon: Calendar },
      ],
    },
    {
      title: "Orders & Reporting",
      isParent: true,
      icon: ShoppingCart,
      items: [
        { label: "Products", href: "/products", icon: Package },
        { label: "Orders", href: "/orders", icon: ShoppingCart },
        { label: "My Cart", href: "/cart", icon: ShoppingCart },
      ],
    },
    {
      title: "Communication",
      isParent: true,
      icon: MessageSquare,
      items: [
        { label: "Support", href: "/support", icon: LifeBuoy },
        { label: "Chat System", href: "/internal-chat", icon: MessageSquare },
        { label: "Document Center", href: "/document-center", icon: FileCheck },
      ],
    },
    {
      title: "Settings",
      isParent: true,
      icon: Settings,
      items: [
        { label: "My Profile", href: "/profile", icon: UserSquare2 },
      ],
    },
  ],
};
