import { useState } from "react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MessageBell } from "@/components/messages/MessageBell";
import { UserDropdown } from "@/components/layout/UserDropdown";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Menu, Home, Calendar, MessageSquare, ShoppingBag, FileText, Pill, User, LogOut } from "lucide-react";
import logoDark from "@/assets/vitaluxe-logo-dark-bg.png";
import logoLight from "@/assets/vitaluxe-logo-light.png";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Appointments", url: "/appointments", icon: Calendar },
  { title: "Messages", url: "/messages", icon: MessageSquare },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Products", url: "/products", icon: ShoppingBag },
  { title: "Medical Vault", url: "/medical-vault", icon: FileText },
  { title: "Prescriptions", url: "/prescriptions", icon: Pill },
  { title: "Profile", url: "/profile", icon: User },
];

export function PatientMobileHeader() {
  const { effectiveRole, isImpersonating, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme } = useTheme();
  const currentLogo = theme === "light" ? logoLight : logoDark;
  
  // Only show for patient users on mobile
  if (effectiveRole !== 'patient') return null;
  
  return (
    <>
      <header 
        className={`sticky z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden ${
          isImpersonating ? 'top-[48px]' : 'top-0'
        }`}
        style={{ touchAction: 'auto' }}>
        <div className="flex h-14 items-center justify-between px-4">
          {/* Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(true)}
            className="h-9 w-9"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src={currentLogo} alt="VitaLuxe" className="h-8 w-auto" />
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1">
            <MessageBell />
            <NotificationBell />
            <ThemeToggle />
            <UserDropdown />
          </div>
        </div>
      </header>

      {/* Navigation Sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2">
              <img src={currentLogo} alt="VitaLuxe" className="h-6 w-auto" />
            </SheetTitle>
          </SheetHeader>
          
          <nav className="flex flex-col py-4">
            {navItems.map((item) => (
              <NavLink
                key={item.url}
                to={item.url}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium border-l-4 border-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </NavLink>
            ))}
            
            <div className="mt-auto pt-4 border-t mx-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="mr-3 h-5 w-5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
