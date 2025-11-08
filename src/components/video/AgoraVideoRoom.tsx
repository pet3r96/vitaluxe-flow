import { useState, useEffect } from "react";
import AgoraUIKit, { PropsInterface } from "agora-react-uikit";
import { supabase } from "@/integrations/supabase/client";

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

  if (!videoCall) {
    return null;
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
