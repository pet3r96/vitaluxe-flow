import { Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WaitingRoomStatusProps {
  estimatedWait?: number; // minutes
  className?: string;
}

export const WaitingRoomStatus = ({
  estimatedWait,
  className,
}: WaitingRoomStatusProps) => {
  return (
    <div className={cn(
      'absolute inset-0 z-50 flex items-center justify-center',
      'bg-background/95 backdrop-blur-sm',
      className
    )}>
      <div className="max-w-md w-full mx-4 p-8 rounded-2xl bg-card border border-border shadow-xl text-center space-y-6">
        {/* Animated Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            {/* Pulse rings */}
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Waiting for Provider
          </h2>
          <p className="text-sm text-muted-foreground">
            You're in the waiting room. The provider will admit you shortly.
          </p>
        </div>

        {/* Estimated Wait Time */}
        {estimatedWait && (
          <div className="flex items-center justify-center gap-2 pt-4 border-t border-border">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Estimated wait: ~{estimatedWait} min
            </span>
          </div>
        )}

        {/* Tips */}
        <div className="pt-4 space-y-2 text-xs text-muted-foreground text-left">
          <p>💡 <span className="font-medium">Tip:</span> Make sure your camera and microphone are enabled</p>
          <p>📱 <span className="font-medium">Note:</span> Please don't close this window</p>
        </div>
      </div>
    </div>
  );
};
