import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Clock, Users, Video } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface VideoRecordingViewerProps {
  recordingUrl: string | null;
  expiresAt: string | null;
  duration: number | null;
  participants?: {
    provider: string;
    patient: string;
  };
  onDownload?: () => void;
}

export const VideoRecordingViewer = ({
  recordingUrl,
  expiresAt,
  duration,
  participants,
  onDownload
}: VideoRecordingViewerProps) => {
  const [isExpired, setIsExpired] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    if (!expiresAt) return;

    const checkExpiration = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      
      if (now >= expiry) {
        setIsExpired(true);
        setTimeRemaining("Expired");
      } else {
        setTimeRemaining(formatDistanceToNow(expiry, { addSuffix: true }));
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!recordingUrl || isExpired) {
    return null;
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Session Recording
          </span>
          {onDownload && (
            <Button
              size="sm"
              variant="outline"
              onClick={onDownload}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <video
            controls
            className="w-full h-full"
            src={recordingUrl}
            controlsList="nodownload"
          >
            Your browser does not support video playback.
          </video>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {duration && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Duration: {formatDuration(duration)}</span>
            </div>
          )}
          
          {participants && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{participants.provider} & {participants.patient}</span>
            </div>
          )}
        </div>

        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <strong>Expiration Notice:</strong> This recording will be automatically deleted {timeRemaining}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
