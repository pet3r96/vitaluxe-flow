import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LucideIcon, Menu, X, Lock, LogOut, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import logoLight from '@/assets/vitaluxe-logo-light.png';
import logoDark from '@/assets/vitaluxe-logo-dark-bg.png';

export interface MobileNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isPro?: boolean;
}

interface MobileMenuNavProps {
  items: MobileNavItem[];
  sections: Array<{
    title: string;
    items: MobileNavItem[];
  }>;
  isSubscribed: boolean;
  effectiveRole: string;
  isStaffAccount: boolean;
  onSignOut: () => void;
  onUpgrade?: () => void;
}

export const MobileMenuNav = ({ 
  sections,
  isSubscribed,
  effectiveRole,
  isStaffAccount,
  onSignOut,
  onUpgrade
}: MobileMenuNavProps) => {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();
  const currentLogo = theme === 'light' ? logoLight : logoDark;

  return (
    <>
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b shadow-sm">
        <div className="flex items-center justify-between h-16 px-4">
          <img 
            src={currentLogo} 
            alt="Vitaluxe Services" 
            className="h-10"
          />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="border-b p-4">
                <div className="flex items-center justify-between">
                  <img 
                    src={currentLogo} 
                    alt="Vitaluxe Services" 
                    className="h-12"
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </SheetHeader>
              
              <div className="flex flex-col h-[calc(100vh-5rem)]">
                <div className="flex-1 overflow-y-auto py-4">
                  {sections.map((section) => (
                    <div key={section.title} className="mb-4">
                      <div className="px-4 mb-2">
                        <h3 className="text-xs uppercase font-semibold text-black dark:text-white tracking-wider">
                          {section.title}
                        </h3>
                      </div>
                      <nav className="space-y-1 px-2">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const isLocked = item.isPro && !isSubscribed;

                          if (isLocked) {
                            return (
                              <button
                                key={item.url}
                                onClick={onUpgrade}
                                className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground/50 hover:bg-muted/50"
                              >
                                <Icon className="h-5 w-5 shrink-0" />
                                <span className="flex-1 text-left">{item.title}</span>
                                <Lock className="h-3 w-3" />
                              </button>
                            );
                          }

                          return (
                            <NavLink
                              key={item.url}
                              to={item.url}
                              onClick={() => setOpen(false)}
                              className={({ isActive }) =>
                                cn(
                                  'flex items-center gap-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 border-l-4',
                                  isActive
                                    ? 'bg-card border-gold1 text-gold1 font-semibold pl-[8px] pr-3'
                                    : 'text-sidebar-foreground hover:text-gold2 hover:bg-muted/10 border-transparent px-3'
                                )
                              }
                            >
                              <Icon className="h-5 w-5 shrink-0" />
                              <span>{item.title}</span>
                            </NavLink>
                          );
                        })}
                      </nav>
                    </div>
                  ))}
                </div>

                {/* Footer Actions */}
                <div className="border-t p-4 space-y-2">
                  {!isSubscribed && effectiveRole === 'doctor' && !isStaffAccount && (
                    <Button
                      onClick={() => {
                        setOpen(false);
                        onUpgrade?.();
                      }}
                      className="w-full justify-start bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
                    >
                      <Sparkles className="h-5 w-5 mr-2" />
                      <span className="text-sm">Upgrade to Pro</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setOpen(false);
                      onSignOut();
                    }}
                  >
                    <LogOut className="h-5 w-5 mr-2" />
                    <span>Sign Out</span>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      {/* Spacer for fixed top bar */}
      <div className="h-16" />
    </>
  );
};
