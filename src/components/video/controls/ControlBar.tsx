import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ControlBarProps {
  children: ReactNode;
  className?: string;
}

export const ControlBar = ({ children, className }: ControlBarProps) => {
  return (
    <div className={cn(
      'flex items-center justify-center gap-2 p-4 bg-card',
      className
    )}>
      {children}
    </div>
  );
};
