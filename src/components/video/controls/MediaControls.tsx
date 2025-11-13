import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface MediaControlsProps {
  isMicMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare?: () => void;
  className?: string;
}

export const MediaControls = ({
  isMicMuted,
  isCameraOff,
  isScreenSharing = false,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  className,
}: MediaControlsProps) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TooltipProvider>
        {/* Microphone */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isMicMuted ? 'destructive' : 'secondary'}
              size="lg"
              onClick={onToggleMic}
              className={cn(
                'h-12 w-12 rounded-full transition-all',
                !isMicMuted && 'hover:bg-secondary/80'
              )}
            >
              {isMicMuted ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isMicMuted ? 'Unmute' : 'Mute'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Camera */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isCameraOff ? 'destructive' : 'secondary'}
              size="lg"
              onClick={onToggleCamera}
              className={cn(
                'h-12 w-12 rounded-full transition-all',
                !isCameraOff && 'hover:bg-secondary/80'
              )}
            >
              {isCameraOff ? (
                <VideoOff className="w-5 h-5" />
              ) : (
                <Video className="w-5 h-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isCameraOff ? 'Turn on camera' : 'Turn off camera'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Screen Share */}
        {onToggleScreenShare && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isScreenSharing ? 'default' : 'secondary'}
                size="lg"
                onClick={onToggleScreenShare}
                className={cn(
                  'h-12 w-12 rounded-full transition-all',
                  !isScreenSharing && 'hover:bg-secondary/80'
                )}
              >
                {isScreenSharing ? (
                  <MonitorOff className="w-5 h-5" />
                ) : (
                  <Monitor className="w-5 h-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isScreenSharing ? 'Stop sharing' : 'Share screen'}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
};
