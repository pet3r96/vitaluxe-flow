import { useState, useEffect } from "react";
import AgoraUIKit, { PropsInterface } from "agora-react-uikit";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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

  if (!videoCall) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Info Banner */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 text-center">
        <p className="text-sm text-blue-600 dark:text-blue-400">
          💡 Allow camera and microphone access when prompted by your browser
        </p>
      </div>

      {/* Session Info Bar */}
      <div className="absolute top-12 left-0 right-0 z-10 bg-background/90 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
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
      <div className="w-full h-full pt-24">
        <AgoraUIKit
          rtcProps={rtcProps}
          callbacks={callbacks}
          styleProps={styleProps}
        />
      </div>
    </div>
  );
}
