import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MobilePageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  actions?: ReactNode;
  className?: string;
}

/**
 * Mobile-optimized page header with optional back button and actions
 */
export const MobilePageHeader = ({ 
  title, 
  subtitle, 
  showBack = false, 
  actions,
  className = ''
}: MobilePageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className={`sticky top-0 z-10 bg-background border-b ${className}`}>
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0 ml-2">{actions}</div>}
      </div>
    </div>
  );
};
