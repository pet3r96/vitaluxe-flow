import { useState, useEffect, useRef } from "react";
import AgoraUIKit, { PropsInterface } from "agora-react-uikit";
import "agora-react-uikit/dist/index.css";
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack, ICameraVideoTrack, IAgoraRTCRemoteUser } from "agora-rtc-sdk-ng";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Video, Mic } from "lucide-react";

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
  const [agoraError, setAgoraError] = useState<string | null>(null);
  const [preJoin, setPreJoin] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [joined, setJoined] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const localTracksRef = useRef<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(null);

  // Enable Agora SDK debug logging
  useEffect(() => {
    console.log('🎥 [AGORA] Initializing Agora SDK debug mode');
    
    // Enable maximum Agora SDK logging
    AgoraRTC.setLogLevel(0); // 0 = DEBUG, most verbose
    
    // Listen for SDK errors
    AgoraRTC.onAutoplayFailed = () => {
      console.error('❌ [AGORA] Autoplay failed - user interaction may be required');
    };
    
    AgoraRTC.onMicrophoneChanged = (info) => {
      console.log('🎤 [AGORA] Microphone changed:', info);
    };
    
    AgoraRTC.onCameraChanged = (info) => {
      console.log('📹 [AGORA] Camera changed:', info);
    };

    // Capture runtime errors
    const errorHandler = (event: ErrorEvent) => {
      if (event.message?.toLowerCase().includes('agora')) {
        console.error('❌ [AGORA RUNTIME ERROR]', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error
        });
        setAgoraError(event.message || 'Agora initialization failed');
      }
    };
    
    window.addEventListener('error', errorHandler);
    return () => {
      window.removeEventListener('error', errorHandler);
    };
  }, []);

  // Temporarily disabled auto-start recording to debug video UI
  // useEffect(() => {
  //   if (!isProvider) return;
  //   const startRecordingTimer = setTimeout(async () => {
  //     try {
  //       setLoading(true);
  //       const { error } = await supabase.functions.invoke('start-video-recording', {
  //         body: { sessionId, channelName }
  //       });
  //       if (!error) {
  //         setRecording(true);
  //         console.log("✅ Recording started automatically");
  //       }
  //     } catch (err) {
  //       console.error("Failed to start recording:", err);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }, 2000);
  //   return () => clearTimeout(startRecordingTimer);
  // }, [isProvider, sessionId, channelName]);

  const handleJoinWithGesture = async () => {
    setPreJoin(false);
    
    if (debugMode) {
      await joinWithRawSDK();
    }
  };

  const joinWithRawSDK = async () => {
    try {
      console.log("🔧 [DEBUG MODE] Starting raw SDK join...");
      
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        console.log("👥 Remote user published:", user.uid, mediaType);
        
        if (mediaType === "video") {
          setRemoteUsers((prev) => [...prev.filter(u => u.uid !== user.uid), user]);
        }
        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
      });

      client.on("user-unpublished", (user) => {
        console.log("👥 Remote user unpublished:", user.uid);
        setRemoteUsers((prev) => prev.filter(u => u.uid !== user.uid));
      });

      await client.join(appId, channelName, token, uid);
      console.log("✅ [DEBUG MODE] Joined channel");

      const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
      localTracksRef.current = tracks;
      console.log("✅ [DEBUG MODE] Created local tracks");

      if (localVideoRef.current) {
        tracks[1].play(localVideoRef.current);
      }

      await client.publish(tracks);
      console.log("✅ [DEBUG MODE] Published local tracks");
      
      setJoined(true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ [DEBUG MODE] Join failed:", errorMsg);
      setAgoraError(`Raw SDK join failed: ${errorMsg}`);
    }
  };

  const handleEndSession = async () => {
    try {
      setLoading(true);
      
      // Cleanup raw SDK if in debug mode
      if (debugMode && clientRef.current) {
        localTracksRef.current?.[0].close();
        localTracksRef.current?.[1].close();
        await clientRef.current.leave();
      }
      
      if (recording) {
        await supabase.functions.invoke('stop-video-recording', {
          body: { sessionId }
        });
      }

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

  console.log('🎥 [FULL AGORA DEBUG]', {
    appId,
    appIdLength: appId?.length,
    appIdValid: appId && /^[0-9a-f]{32}$/i.test(appId),
    appIdSample: appId ? appId.substring(0, 8) + '...' : 'MISSING',
    channelName,
    channelNameLength: channelName?.length,
    channelNameValid: channelName && channelName.length > 0,
    token,
    tokenLength: token?.length,
    tokenValid: token && token.length > 20,
    tokenPreview: token ? token.substring(0, 20) + '...' : 'MISSING',
    uid,
    uidType: typeof uid,
    uidValue: uid,
    uidValid: uid !== null && uid !== undefined && !isNaN(uid),
    hasAppId: !!appId,
    hasChannel: !!channelName,
    hasToken: !!token,
    hasUid: uid !== null && uid !== undefined,
    isProvider,
    userName
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

  // Show pre-join screen
  if (preJoin && hasRequiredFields) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-lg p-8 max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Video className="w-8 h-8 text-primary" />
              <Mic className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold">Ready to Join?</h2>
            <p className="text-muted-foreground">
              Click below to join with camera & microphone. You may see a permissions prompt.
            </p>
          </div>
          
          {isProvider && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <input
                type="checkbox"
                id="debug-mode"
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="debug-mode" className="text-muted-foreground cursor-pointer">
                Debug Mode (raw SDK)
              </label>
            </div>
          )}
          
          <Button
            onClick={handleJoinWithGesture}
            size="lg"
            className="w-full"
          >
            Join with Camera & Mic
          </Button>
          
          <button
            onClick={onLeave}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Show Agora runtime error if captured
  if (agoraError) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-destructive rounded-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-semibold text-destructive mb-4">Agora SDK Error</h2>
          <p className="text-sm text-muted-foreground mb-4">{agoraError}</p>
          <pre className="bg-muted p-3 rounded text-xs overflow-auto mb-4 max-h-48">
            {JSON.stringify({ 
              appId: appId ? appId.substring(0, 8) + '...' : 'MISSING',
              channelName, 
              uid,
              uidType: typeof uid,
              hasToken: !!token,
              tokenLength: token?.length 
            }, null, 2)}
          </pre>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Reload & Retry
            </button>
            <button
              onClick={onLeave}
              className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    );
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

  // Debug mode: render raw SDK view
  if (debugMode && joined) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="absolute top-4 right-4 z-10 space-x-2">
          <Button onClick={handleEndSession} variant="destructive">
            End Call
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 p-4 h-full">
          <div className="relative bg-gray-900 rounded-lg overflow-hidden">
            <div ref={localVideoRef} className="w-full h-full" />
            <div className="absolute bottom-4 left-4 text-white text-sm bg-black/50 px-2 py-1 rounded">
              You (Local)
            </div>
          </div>
          
          {remoteUsers.map((user) => (
            <div key={user.uid} className="relative bg-gray-900 rounded-lg overflow-hidden">
              <div
                ref={(el) => {
                  if (el && user.videoTrack) {
                    user.videoTrack.play(el);
                  }
                }}
                className="w-full h-full"
              />
              <div className="absolute bottom-4 left-4 text-white text-sm bg-black/50 px-2 py-1 rounded">
                Remote User {user.uid}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Normal mode: render UIKit
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <AgoraUIKit
        rtcProps={rtcProps}
        callbacks={callbacks}
      />
    </div>
  );
}
