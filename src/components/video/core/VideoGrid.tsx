import { ReactNode, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ILocalVideoTrack } from 'agora-rtc-sdk-ng';
import { AgoraRemoteUser } from '@/hooks/video/useAgoraCore';
import { RemoteVideoTile } from './RemoteVideoTile';
import { LocalVideoPreview } from './LocalVideoPreview';

export interface VideoGridProps {
  localVideoTrack: ILocalVideoTrack | null;
  remoteUsers: AgoraRemoteUser[];
  activeUserId?: string;
  isMicMuted?: boolean;
  isCameraOff?: boolean;
  className?: string;
}

export const VideoGrid = ({
  localVideoTrack,
  remoteUsers,
  activeUserId,
  isMicMuted = false,
  isCameraOff = false,
  className,
}: VideoGridProps) => {
  const localVideoRef = useRef<HTMLDivElement>(null);

  // Play local video
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      localVideoTrack.play(localVideoRef.current);
    }

    return () => {
      if (localVideoTrack) {
        localVideoTrack.stop();
      }
    };
  }, [localVideoTrack]);

  const remoteUsersWithVideo = remoteUsers.filter(u => u.hasVideo);
  const totalUsers = remoteUsersWithVideo.length;

  // Determine grid layout based on number of participants
  const getGridClass = () => {
    if (totalUsers === 0) return 'grid-cols-1';
    if (totalUsers === 1) return 'grid-cols-1';
    if (totalUsers === 2) return 'grid-cols-2';
    return 'grid-cols-2 lg:grid-cols-3';
  };

  return (
    <div className={cn('relative w-full h-full flex items-center justify-center p-4', className)}>
      {/* Main Video Grid */}
      <div className={cn(
        'w-full h-full grid gap-4',
        getGridClass()
      )}>
        {remoteUsersWithVideo.map((user) => (
          <RemoteVideoTile
            key={user.uid}
            user={user}
            isActive={user.uid === activeUserId}
          />
        ))}

        {/* Empty state if no remote users */}
        {totalUsers === 0 && (
          <div className="flex items-center justify-center w-full h-full bg-muted/20 rounded-xl border-2 border-dashed border-border">
            <div className="text-center space-y-2">
              <div className="text-4xl">👋</div>
              <p className="text-sm text-muted-foreground">
                Waiting for other participants to join...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Local Video Preview - Bottom Right Corner */}
      <div className="absolute bottom-6 right-6 z-10">
        <LocalVideoPreview
          videoRef={localVideoRef}
          isMuted={isMicMuted}
          isCameraOff={isCameraOff}
        />
      </div>
    </div>
  );
};
