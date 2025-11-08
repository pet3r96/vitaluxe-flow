import { useState, useEffect } from "react";
import AgoraUIKit, { PropsInterface } from "agora-react-uikit";
import { supabase } from "@/integrations/supabase/client";

interface AgoraVideoRoomProps {
  channelName: string;
  token: string;
  uid: number;
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

  // Auto-start recording when provider joins and remote user is present
  useEffect(() => {
    if (!isProvider) return;

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
  }, [isProvider, sessionId, channelName]);

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

  // Validate required fields
  const hasRequiredFields = appId && channelName && token && uid;
  
  const rtcProps: PropsInterface['rtcProps'] = {
    appId: appId,
    channel: channelName,
    token: token,
    uid: uid,
  };

  // Debug logging
  console.log("🎥 Initializing Agora UIKit with:", {
    appId: appId ? "✓ present" : "✗ missing",
    channel: channelName,
    token: token ? "✓ present" : "✗ missing",
    uid: uid,
    uidType: typeof uid
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

  if (!videoCall) {
    return null;
  }

  // Safety net: show error UI if required fields are missing
  if (!hasRequiredFields) {
    console.error("❌ Missing required Agora fields:", { appId: !!appId, channelName: !!channelName, token: !!token, uid: !!uid });
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full text-center space-y-4">
          <h2 className="text-xl font-semibold text-destructive">Connection Failed</h2>
          <p className="text-muted-foreground">
            Unable to initialize video session. Missing required connection details.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Try Again
            </button>
            <button
              onClick={onLeave}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <AgoraUIKit
        rtcProps={rtcProps}
        callbacks={callbacks}
      />
    </div>
  );
}
