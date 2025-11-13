import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Signal } from 'lucide-react';
import { AgoraRemoteUser } from '@/hooks/video/useAgoraCore';

export interface RemoteVideoTileProps {
  user: AgoraRemoteUser;
  isActive?: boolean;
  className?: string;
}

export const RemoteVideoTile = ({
  user,
  isActive = false,
  className,
}: RemoteVideoTileProps) => {
  const videoRef = useRef<HTMLDivElement>(null);

  // Play remote video
  useEffect(() => {
    if (user.videoTrack && videoRef.current) {
      user.videoTrack.play(videoRef.current);
    }

    return () => {
      if (user.videoTrack) {
        user.videoTrack.stop();
      }
    };
  }, [user.videoTrack]);

  return (
    <div className={cn(
      'relative w-full h-full rounded-xl overflow-hidden',
      'bg-muted border-2 transition-all duration-300',
      isActive ? 'border-primary ring-2 ring-primary/50' : 'border-border',
      className
    )}>
      {/* Video Container */}
      <div
        ref={videoRef}
        className={cn(
          'w-full h-full',
          !user.hasVideo && 'bg-muted flex items-center justify-center'
        )}
      >
        {!user.hasVideo && (
          <div className="text-center space-y-3">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-3xl font-semibold text-primary">
                {user.uid.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Camera Off</p>
          </div>
        )}
      </div>

      {/* Name Tag */}
      <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm">
        <span className="text-sm text-white font-medium">
          User {user.uid.slice(-4)}
        </span>
      </div>

      {/* Audio Indicator */}
      <div className="absolute top-3 left-3">
        {!user.hasAudio ? (
          <div className="w-8 h-8 rounded-full bg-red-500/90 flex items-center justify-center">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-green-500/90 flex items-center justify-center">
            <Mic className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Connection Quality Badge */}
      <div className="absolute top-3 right-3">
        <div className="px-2 py-1 rounded bg-black/60 backdrop-blur-sm flex items-center gap-1">
          <Signal className="w-3 h-3 text-green-400" />
          <span className="text-xs text-white">Good</span>
        </div>
      </div>

      {/* Active Speaker Ring */}
      {isActive && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 rounded-xl border-4 border-primary animate-pulse" />
        </div>
      )}
    </div>
  );
};
