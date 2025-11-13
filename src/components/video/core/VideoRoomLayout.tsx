import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface VideoRoomLayoutProps {
  leftPanel?: ReactNode;
  centerContent: ReactNode;
  rightPanel?: ReactNode;
  controlBar?: ReactNode;
  showLeftPanel?: boolean;
  showRightPanel?: boolean;
  className?: string;
}

export const VideoRoomLayout = ({
  leftPanel,
  centerContent,
  rightPanel,
  controlBar,
  showLeftPanel = true,
  showRightPanel = true,
  className,
}: VideoRoomLayoutProps) => {
  return (
    <div className={cn('relative w-full h-screen flex flex-col bg-background', className)}>
      {/* Main Content Area - Three Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Patient Identity / Waiting Room */}
        {showLeftPanel && leftPanel && (
          <aside className={cn(
            'hidden lg:flex flex-col border-r border-border bg-card',
            'w-full lg:w-[280px] overflow-y-auto',
            'transition-all duration-300'
          )}>
            {leftPanel}
          </aside>
        )}

        {/* Center - Video Grid */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          {centerContent}
        </main>

        {/* Right Panel - Patient Chart */}
        {showRightPanel && rightPanel && (
          <aside className={cn(
            'hidden xl:flex flex-col border-l border-border bg-card',
            'w-full xl:w-[400px] overflow-y-auto',
            'transition-all duration-300'
          )}>
            {rightPanel}
          </aside>
        )}
      </div>

      {/* Bottom Control Bar */}
      {controlBar && (
        <div className="border-t border-border bg-card">
          {controlBar}
        </div>
      )}
    </div>
  );
};
