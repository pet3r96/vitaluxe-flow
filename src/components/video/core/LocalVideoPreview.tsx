import { RefObject, useState } from 'react';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

export interface LocalVideoPreviewProps {
  videoRef: RefObject<HTMLDivElement>;
  isMuted?: boolean;
  isCameraOff?: boolean;
  className?: string;
}

export const LocalVideoPreview = ({
  videoRef,
  isMuted = false,
  isCameraOff = false,
  className,
}: LocalVideoPreviewProps) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="w-12 h-12 rounded-full bg-card border-2 border-border shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        aria-label="Show local video"
      >
        <Video className="w-5 h-5 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className={cn(
      'relative w-48 h-36 rounded-xl overflow-hidden',
      'bg-card border-2 border-border shadow-xl',
      'transition-all duration-300 hover:shadow-2xl',
      className
    )}>
      {/* Video Container */}
      <div 
        ref={videoRef}
        className={cn(
          'w-full h-full',
          isCameraOff && 'bg-muted flex items-center justify-center'
        )}
      >
        {isCameraOff && (
          <div className="text-center space-y-2">
            <VideoOff className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Camera Off</p>
          </div>
        )}
      </div>

      {/* Name Tag */}
      <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
        <span className="text-xs text-white font-medium">You</span>
      </div>

      {/* Status Indicators */}
      <div className="absolute top-2 right-2 flex gap-1">
        {isMuted && (
          <div className="w-6 h-6 rounded-full bg-red-500/90 flex items-center justify-center">
            <MicOff className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Minimize Button */}
      <button
        onClick={() => setIsMinimized(true)}
        className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-colors flex items-center justify-center"
        aria-label="Minimize local video"
      >
        <span className="text-white text-xs">−</span>
      </button>
    </div>
  );
};
