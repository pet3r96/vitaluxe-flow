import { ReactNode } from 'react';

interface ResponsivePageProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Responsive page wrapper that provides consistent spacing and layout
 * 
 * Usage:
 * <ResponsivePage title="Page Title" subtitle="Description" actions={<Button>Action</Button>}>
 *   {content}
 * </ResponsivePage>
 */
export const ResponsivePage = ({ 
  title, 
  subtitle, 
  actions, 
  children, 
  className = '' 
}: ResponsivePageProps) => {
  return (
    <div className={`space-y-4 sm:space-y-6 ${className}`}>
      {(title || subtitle || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            {title && (
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-sm sm:text-base text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}
      <div className="space-y-4 sm:space-y-6">
        {children}
      </div>
    </div>
  );
};
