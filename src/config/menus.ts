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
      title: "Main Menu",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Products", href: "/products", icon: Package },
        { label: "Orders", href: "/orders", icon: ShoppingCart },
        { label: "Messages", href: "/messages", icon: MessageSquare },
        { label: "Patients", href: "/patients", icon: Users },
        { label: "Providers", href: "/providers", icon: UserRoundCog, isPro: true },
        { label: "Staff", href: "/staff", icon: Users, isPro: true },
        { label: "Calendar", href: "/practice-calendar", icon: Calendar, isPro: true },
        { label: "Patient Inbox", href: "/practice/patient-inbox", icon: Inbox, isPro: true },
        { label: "Document Center", href: "/document-center", icon: FileCheck, isPro: true },
        { label: "Reporting", href: "/practice-reporting", icon: BarChart3, isPro: true },
        { label: "Internal Chat", href: "/internal-chat", icon: MessageSquare, isPro: true },
        { label: "My Subscription", href: "/my-subscription", icon: CreditCard, isPro: true },
      ],
    },
  ],

  provider: [
    {
      title: "Main Menu",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Products", href: "/products", icon: Package },
        { label: "Orders", href: "/orders", icon: ShoppingCart },
        { label: "Messages", href: "/messages", icon: MessageSquare },
        { label: "Patients", href: "/patients", icon: Users },
        { label: "Calendar", href: "/practice-calendar", icon: Calendar, isPro: true },
        { label: "Patient Inbox", href: "/practice/patient-inbox", icon: Inbox, isPro: true },
        { label: "Document Center", href: "/document-center", icon: FileCheck, isPro: true },
        { label: "Reporting", href: "/practice-reporting", icon: BarChart3, isPro: true },
        { label: "Internal Chat", href: "/internal-chat", icon: MessageSquare, isPro: true },
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
      title: "Main Menu",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Products", href: "/products", icon: Package },
        { label: "Orders", href: "/orders", icon: ShoppingCart },
        { label: "Messages", href: "/messages", icon: MessageSquare },
        { label: "Patients", href: "/patients", icon: Users },
        { label: "Calendar", href: "/practice-calendar", icon: Calendar },
        { label: "Patient Inbox", href: "/practice/patient-inbox", icon: Inbox },
        { label: "Document Center", href: "/document-center", icon: FileCheck },
        { label: "Internal Chat", href: "/internal-chat", icon: MessageSquare },
      ],
    },
  ],
};
