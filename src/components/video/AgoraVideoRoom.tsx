import { useState, useEffect } from "react";
import AgoraUIKit, { PropsInterface } from "agora-react-uikit";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";

interface AgoraVideoRoomProps {
  channelName: string;
  token: string;
  uid: string;
  appId: string;
  onLeave: () => void;
  isProvider: boolean;
  sessionId: string;
  userName?: string;
}

export function AgoraVideoRoom({
  channelName,
  token,
  uid,
  appId,
  onLeave,
  isProvider,
  sessionId,
  userName = "User",
}: AgoraVideoRoomProps) {
  const [videoCall, setVideoCall] = useState(true);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Request camera and microphone permissions
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        console.log("🎤 Requesting camera/microphone permissions...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
        
        console.log("✅ Permissions granted");
        setPermissionsGranted(true);
      } catch (err) {
        console.error("❌ Permission denied:", err);
        setPermissionError("Camera and microphone access is required for video calls. Please allow access and try again.");
      }
    };

    requestPermissions();
  }, []);

  // Auto-start recording when provider joins and remote user is present
  useEffect(() => {
    if (!isProvider || !permissionsGranted) return;

    const startRecordingTimer = setTimeout(async () => {
      try {
        setLoading(true);
        const { error } = await supabase.functions.invoke('start-video-recording', {
          body: { sessionId, channelName }
        });
        
        if (!error) {
          setRecording(true);
          console.log("✅ Recording started automatically");
        }
      } catch (err) {
        console.error("Failed to start recording:", err);
      } finally {
        setLoading(false);
      }
    }, 2000); // Wait 2s for both parties to join

    return () => clearTimeout(startRecordingTimer);
  }, [isProvider, sessionId, channelName, permissionsGranted]);

  const handleEndSession = async () => {
    try {
      setLoading(true);
      
      // Stop recording if active
      if (recording) {
        await supabase.functions.invoke('stop-video-recording', {
          body: { sessionId }
        });
      }

      // End session
      await supabase.functions.invoke('end-video-session', {
        body: { sessionId }
      });

      setVideoCall(false);
      onLeave();
    } catch (error) {
      console.error('Error ending session:', error);
      setVideoCall(false);
      onLeave();
    } finally {
      setLoading(false);
    }
  };

  const parsedUid = parseInt(uid.replace(/[^0-9]/g, '').slice(0, 10)) || 0;
  
  const rtcProps: PropsInterface['rtcProps'] = {
    appId: appId,
    channel: channelName,
    token: token,
    uid: parsedUid,
    role: 'host',
  };

  // Debug logging
  console.log("🎥 Initializing Agora UIKit with:", {
    appId: appId ? "✓ present" : "✗ missing",
    channel: channelName,
    token: token ? "✓ present" : "✗ missing",
    uid: parsedUid,
    role: 'host'
  });

  const callbacks: PropsInterface['callbacks'] = {
    EndCall: () => {
      setVideoCall(false);
      if (isProvider) {
        handleEndSession();
      } else {
        onLeave();
      }
    },
  };

  const styleProps: PropsInterface['styleProps'] = {
    localBtnContainer: {
      backgroundColor: 'transparent',
      bottom: '20px',
    },
    theme: '#1a1a1a',
  };

  // Show loading while requesting permissions
  if (!permissionsGranted && !permissionError) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-foreground">Requesting camera and microphone access...</p>
          <p className="text-sm text-muted-foreground">Please allow access when prompted</p>
        </div>
      </div>
    );
  }

  // Show error if permissions denied
  if (permissionError) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md">
          <div className="text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Permission Required</h2>
            <p className="text-muted-foreground">{permissionError}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
              <Button variant="outline" onClick={onLeave}>
                Go Back
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!videoCall) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Session Info Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-background/90 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">Video Session Active</span>
          {recording && (
            <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded">
              ● Recording
            </span>
          )}
        </div>
        
        {isProvider && (
          <Button
            onClick={handleEndSession}
            disabled={loading}
            variant="destructive"
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Ending...
              </>
            ) : (
              'End Session'
            )}
          </Button>
        )}
      </div>

      {/* Agora UIKit */}
      <div className="w-full h-full pt-16">
        <AgoraUIKit
          rtcProps={rtcProps}
          callbacks={callbacks}
          styleProps={styleProps}
        />
      </div>
    </div>
  );
}
