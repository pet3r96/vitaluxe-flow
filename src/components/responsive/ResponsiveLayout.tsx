import { ReactNode } from 'react';
import { useResponsive } from '@/hooks/use-mobile';
import { getResponsivePadding } from '@/lib/responsive';

interface ResponsiveLayoutProps {
  children: ReactNode;
  mobileComponent?: ReactNode;
  desktopComponent?: ReactNode;
  className?: string;
}

/**
 * Responsive layout wrapper that automatically switches between mobile and desktop views
 * 
 * Usage:
 * 1. Render different components: <ResponsiveLayout mobileComponent={<Mobile />} desktopComponent={<Desktop />} />
 * 2. Auto-adjust padding: <ResponsiveLayout>{children}</ResponsiveLayout>
 */
export const ResponsiveLayout = ({ 
  children, 
  mobileComponent, 
  desktopComponent,
  className = ''
}: ResponsiveLayoutProps) => {
  const { isMobile } = useResponsive();

  // If separate mobile/desktop components provided, render conditionally
  if (mobileComponent && desktopComponent) {
    return (
      <div className={className}>
        {isMobile ? mobileComponent : desktopComponent}
      </div>
    );
  }

  // Otherwise, wrap children with responsive padding
  const padding = getResponsivePadding(isMobile);
  
  return (
    <div className={`${padding} ${className}`}>
      {children}
    </div>
  );
};

