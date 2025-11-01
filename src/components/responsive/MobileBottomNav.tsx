import { NavLink } from 'react-router-dom';
import { LucideIcon, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

export interface MobileNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isPro?: boolean;
}

interface MobileBottomNavProps {
  items: MobileNavItem[];
  maxVisibleItems?: number;
}

/**
 * Mobile bottom navigation bar
 * Shows top N items + "More" menu for remaining items
 */
export const MobileBottomNav = ({ items, maxVisibleItems = 4 }: MobileBottomNavProps) => {
  // Filter out pro items if needed and separators
  const visibleItems = items
    .filter(item => item.url && item.title !== 'PRO_SEPARATOR')
    .slice(0, maxVisibleItems);
  
  const moreItems = items
    .filter(item => item.url && item.title !== 'PRO_SEPARATOR')
    .slice(maxVisibleItems);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors flex-1',
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.title}</span>
            </NavLink>
          );
        })}

        {moreItems.length > 0 && (
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                className="flex flex-col items-center justify-center gap-1 px-3 py-2 flex-1"
              >
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-xs font-medium">More</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[50vh]">
              <SheetHeader>
                <SheetTitle>More Options</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {moreItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                          isActive
                            ? 'text-primary bg-primary/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )
                      }
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.title}</span>
                    </NavLink>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </nav>
  );
};
