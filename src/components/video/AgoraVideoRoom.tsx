import { useState, useEffect, useRef } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  ILocalVideoTrack,
} from "agora-rtc-sdk-ng";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MonitorUp,
  Circle,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { NetworkQualityIndicator } from "./NetworkQualityIndicator";
import { useVideoChat } from "@/hooks/useVideoChat";
import { VideoChatPanel } from "./VideoChatPanel";
import { useVideoErrorLogger } from "@/hooks/useVideoErrorLogger";
import { useTokenAutoRefresh } from "@/hooks/useTokenAutoRefresh";

interface AgoraVideoRoomProps {
  channelName: string;
  token: string;
  uid: string;
  appId: string;
  onLeave: () => void;
  isProvider?: boolean;
  sessionId: string;
  rtmToken?: string;
  rtmUid?: string;
  userName?: string;
  skipRTM?: boolean;
}

export const AgoraVideoRoom = ({
  channelName,
  token,
  uid,
  appId,
  onLeave,
  isProvider = false,
  sessionId,
  rtmToken,
  rtmUid,
  userName = "User",
  skipRTM = false,
}: AgoraVideoRoomProps) => {
  const { toast } = useToast();
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [screenTrack, setScreenTrack] = useState<ILocalVideoTrack | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'not_started' | 'starting' | 'active' | 'stopping' | 'stopped'>('not_started');
  const [backendEcho, setBackendEcho] = useState<{appIdSample: string; cert8: string} | null>(null);
  const [joinAttempt, setJoinAttempt] = useState(0);
  
  // Agora SDK error capture
  const [rtcErrorCode, setRtcErrorCode] = useState<string | number | null>(null);
  const [rtcErrorMessage, setRtcErrorMessage] = useState<string | null>(null);
  const [rtmErrorCode, setRtmErrorCode] = useState<string | number | null>(null);
  const [rtmErrorMessage, setRtmErrorMessage] = useState<string | null>(null);

  const quality = useNetworkQuality(client, sessionId);
  const { logVideoError } = useVideoErrorLogger();
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const screenTrackRef = useRef<ILocalVideoTrack | null>(null);
  const isComponentMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);

  const resetSessionState = () => {
    if (!isComponentMountedRef.current) {
      return;
    }

    setRemoteUsers([]);
    setSessionDuration(0);
    setRecordingStatus('not_started');
    setIsScreenSharing(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setShowChat(false);

    if (localVideoTrackRef.current) {
      try {
        localVideoTrackRef.current.stop();
      } catch (err) {
        console.warn("Failed to stop local video track during reset:", err);
      }
      localVideoTrackRef.current.close();
      localVideoTrackRef.current = null;
    }
    setLocalVideoTrack(null);

    if (localAudioTrackRef.current) {
      try {
        localAudioTrackRef.current.stop();
      } catch (err) {
        console.warn("Failed to stop local audio track during reset:", err);
      }
      localAudioTrackRef.current.close();
      localAudioTrackRef.current = null;
    }
    setLocalAudioTrack(null);

    if (screenTrackRef.current) {
      try {
        screenTrackRef.current.stop?.();
      } catch (err) {
        console.warn("Failed to stop screen track during reset:", err);
      }
      screenTrackRef.current.close();
      screenTrackRef.current = null;
    }
    setScreenTrack(null);
  };

  const cleanupClientConnections = async () => {
    const existingClient = clientRef.current;
    if (!existingClient) return;

    existingClient.removeAllListeners();
    try {
      await existingClient.leave();
    } catch (err) {
      console.warn("Failed to leave existing Agora client:", err);
    }
    clientRef.current = null;
    if (isComponentMountedRef.current) {
      setClient(null);
    }
  };

  // Fetch backend echo on mount for diagnostics
  useEffect(() => {
    const fetchBackendEcho = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('agora-echo');
        if (!error && data) {
          setBackendEcho({ appIdSample: data.appIdSample, cert8: data.cert8 });
          console.log("[AgoraVideoRoom] Backend echo:", data);
        }
      } catch (err) {
        console.warn("[AgoraVideoRoom] Could not fetch backend echo:", err);
      }
    };
    fetchBackendEcho();
  }, []);

  const chat = (rtmToken && rtmUid && !skipRTM) ? useVideoChat({
    appId,
    rtmToken,
    rtmUid,
    channelName,
    sessionId,
    userName,
    userType: isProvider ? "provider" : "patient",
  }) : { messages: [], sendMessage: async () => {}, isConnected: false, renewRtmToken: async () => {}, rtmErrorCode: null, rtmErrorMessage: null };

  // Auto-refresh tokens to prevent session interruptions
  useTokenAutoRefresh({
    client,
    sessionId,
    channelName,
    onRtmTokenRefresh: chat.renewRtmToken,
    enabled: !!client,
  });

  useEffect(() => {
    let cancelled = false;

    const initClient = async () => {
      await cleanupClientConnections();
      if (cancelled) return;

      resetSessionState();

      try {
        // Set detailed logging for diagnostics
        AgoraRTC.setLogLevel(4);
        
        console.log("=== FE AGORA DEBUG ===");
        console.log("AppID:", appId);
        console.log("Channel:", channelName);
        console.log("UID:", uid);
        console.log("Token10:", token.slice(0, 10));
        console.log("Skip RTM:", skipRTM);
        console.log("=======================");
        
        const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        clientRef.current = agoraClient;
        setClient(agoraClient);

        agoraClient.on("user-published", async (user, mediaType) => {
          await agoraClient.subscribe(user, mediaType);

          if (mediaType === "video") {
            setRemoteUsers(prev => {
              const existing = prev.find(u => u.uid === user.uid);
              if (existing) {
                return prev.map(u => u.uid === user.uid ? user : u);
              }
              return [...prev, user];
            });
          }

          if (mediaType === "audio") {
            user.audioTrack?.play();
          }
        });

        agoraClient.on("user-unpublished", (user, mediaType) => {
          if (mediaType === "video") {
            setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
          }
        });

        agoraClient.on("user-left", (user) => {
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        });

        // Join the channel with the token from backend
        // CRITICAL: Ensure UID is a string to match token generation
        const joinUid = String(uid);
        
        console.log("===== FE TOKEN DEBUG =====");
        console.log("FE RTC Token (full):", token);
        console.log("FE RTM Token (full):", rtmToken);
        console.log("RTC Token length:", token?.length);
        console.log("RTM Token length:", rtmToken?.length);
        console.log("RTC Token prefix:", token?.substring(0, 20));
        console.log("RTM Token prefix:", rtmToken?.substring(0, 20));
        console.log("Agora Join Params:", {
          appId,
          channelName,
          uid: joinUid,
        });
        console.log("================================");
        
        try {
          await agoraClient.join(appId, channelName, token, joinUid);
          console.log('✅ [AgoraVideoRoom] Successfully joined RTC channel');
          // Clear any previous errors on successful join
          setRtcErrorCode(null);
          setRtcErrorMessage(null);
        } catch (err: any) {
          console.error("=== AGORA RTC JOIN ERROR ===", err);
          console.error("Error Code:", err.code);
          console.error("Error Name:", err.name);
          console.error("Error Message:", err.message);
          console.error("Full Error Object:", err);
          console.error("Error Stack:", err.stack);
          console.error("Parameters Used:", {
            appId,
            channelName,
            uid: joinUid,
            tokenPrefix: token.substring(0, 20),
            tokenLength: token.length,
          });
          console.error("============================");
          
          // Capture error for debug panel
          setRtcErrorCode(err.code || null);
          setRtcErrorMessage(err.message || String(err));
          
          throw err;
        }

        const prefs = JSON.parse(localStorage.getItem("video.devicePrefs") || "{}");
        console.log("📱 Using device preferences:", prefs);

        let audioTrack: IMicrophoneAudioTrack;
        try {
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack(
            prefs?.micId ? { microphoneId: prefs.micId } : undefined
          );
          console.log("✅ Audio track created with preferred device");
        } catch (e) {
          console.warn("⚠️ Mic create failed with chosen device, falling back:", e);
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        }

        let videoTrack: ICameraVideoTrack;
        try {
          videoTrack = await AgoraRTC.createCameraVideoTrack(
            prefs?.cameraId ? { cameraId: prefs.cameraId } : undefined
          );
          console.log("✅ Video track created with preferred device");
        } catch (e) {
          console.warn("⚠️ Camera create failed with chosen device, falling back:", e);
          videoTrack = await AgoraRTC.createCameraVideoTrack();
        }

        localAudioTrackRef.current = audioTrack;
        localVideoTrackRef.current = videoTrack;
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);

        await agoraClient.publish([audioTrack, videoTrack]);

        videoTrack.play("local-player");

        if (quality.downlinkQuality >= 3 && quality.downlinkQuality <= 6) {
          videoTrack.setEncoderConfiguration({
            width: 640,
            height: 480,
            frameRate: 15,
            bitrateMin: 200,
            bitrateMax: 500,
          });
        }

        toast({
          title: "Connected",
          description: "You have joined the video consultation"
        });
      } catch (error: any) {
        console.group("🔴 AGORA JOIN FAILURE");
        console.error("Error Object:", error);
        console.log("Attempt:", joinAttempt + 1);
        console.log("Error Code:", error.code);
        console.log("Error Message:", error.message);
        console.log("Error Name:", error.name);
        console.log("Skip RTM:", skipRTM);
        console.log("Join Parameters Used:");
        console.log("  - FE App ID:", appId);
        console.log("  - FE Token prefix:", token.substring(0, 30));
        console.log("  - Channel:", channelName);
        console.log("  - UID:", uid);
        if (backendEcho) {
          console.log("  - BE App ID Sample:", backendEcho.appIdSample);
          console.log("  - BE Cert8:", backendEcho.cert8);
        }
        console.groupEnd();
        
        // Auto-retry once for gateway errors
        if (error.code === "CAN_NOT_GET_GATEWAY_SERVER" && joinAttempt === 0) {
          console.log("[AgoraVideoRoom] Retrying join after gateway failure...");
          setJoinAttempt(1);
          
          toast({
            title: "Retrying Connection",
            description: "Gateway handshake failed. Fetching fresh token and retrying...",
          });
          
          // Wait 1.2s, fetch fresh token, retry
          await new Promise(resolve => setTimeout(resolve, 1200));
          
          try {
            const { data: refreshData, error: refreshError } = await supabase.functions.invoke('join-video-session', {
              body: { sessionId }
            });
            
            if (refreshError || !refreshData || !clientRef.current) {
              throw new Error("Failed to refresh token or client not available");
            }
            
            console.log("RAW BACKEND TOKEN RESPONSE (retry):", refreshData);
            console.log("===== FE TOKEN DEBUG (retry) =====");
            console.log("FE RTC Token (full):", refreshData?.token);
            console.log("FE RTM Token (full):", refreshData?.rtmToken);
            console.log("RTC Token length:", refreshData?.token?.length);
            console.log("RTM Token length:", refreshData?.rtmToken?.length);
            console.log("RTC Token prefix:", refreshData?.token?.substring(0, 20));
            console.log("RTM Token prefix:", refreshData?.rtmToken?.substring(0, 20));
            console.log("Agora Join Params:", {
              appId: refreshData?.appId,
              channelName: refreshData?.channelName,
              uid: String(refreshData?.uid)
            });
            console.log("================================");
            
            console.log("[AgoraVideoRoom] Retrying with fresh token...");
            await clientRef.current.join(
              refreshData.appId,
              refreshData.channelName,
              refreshData.token,
              String(refreshData.uid)
            );
            
            toast({
              title: "Reconnected",
              description: "Successfully connected on retry",
            });
            return; // Success, exit early
          } catch (retryError: any) {
            console.error("[AgoraVideoRoom] Retry failed:", retryError);
            // Fall through to show error
          }
        }

        await logVideoError({
          sessionId,
          errorCode: error.code,
          errorMessage: error.message || String(error),
          errorName: error.name,
          joinParams: {
            appIdSample: appId.substring(0, 8) + "...",
            channelName,
            uid,
            tokenPreview: token.substring(0, 20) + "...",
            isProvider,
          }
        });

        let errorTitle = "Connection Error";
        let errorDescription = "Failed to join video session";

        if (error.code === "INVALID_VENDOR_KEY") {
          errorTitle = "Invalid Agora App ID";
          errorDescription = "The Agora App ID is not recognized. Next steps: 1) Verify App ID in Agora Console matches backend secrets, 2) Ensure project is Active (not archived), 3) Try the Video Test Room with a Console-generated token.";
        } else if (error.code === "INVALID_TOKEN" || error.code === "TOKEN_EXPIRED") {
          errorTitle = "Invalid Session Token";
          errorDescription = "Token validation failed. Next steps: 1) Verify App Certificate matches (first 8 chars), 2) Check token format (should start with 007), 3) Ensure certificate hasn't been rotated recently.";
        } else if (error.code === "CAN_NOT_GET_GATEWAY_SERVER") {
          errorTitle = "Gateway Connection Failed";
          errorDescription = "Cannot establish gateway connection. Retrying automatically... If this persists: 1) Try switching network (e.g., mobile hotspot), 2) Test in Video Test Room, 3) Check Credential Validator for mismatches.";
        } else if (error.message?.includes("Permission denied")) {
          errorTitle = "Permission Denied";
          errorDescription = "Camera/microphone access blocked. Next steps: 1) Click the camera icon in browser address bar to allow permissions, 2) Reload the page after granting access.";
        } else if (error.message?.includes("network")) {
          errorTitle = "Network Error";
          errorDescription = "Network connectivity issue detected. Next steps: 1) Check internet connection, 2) Try a different network, 3) Disable VPN if active.";
        }

        toast({
          title: errorTitle,
          description: errorDescription,
          variant: "destructive"
        });

        await cleanupClientConnections();
      }
    };

    initClient();

    const timer = setInterval(() => {
      setSessionDuration(prev => prev + 1);
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);

      if (screenTrackRef.current) {
        try {
          screenTrackRef.current.stop?.();
        } catch (err) {
          console.warn("Failed to stop screen track during cleanup:", err);
        }
        screenTrackRef.current.close();
        screenTrackRef.current = null;
      }

      if (localVideoTrackRef.current) {
        try {
          localVideoTrackRef.current.stop();
        } catch (err) {
          console.warn("Failed to stop local video track during cleanup:", err);
        }
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }

      if (localAudioTrackRef.current) {
        try {
          localAudioTrackRef.current.stop();
        } catch (err) {
          console.warn("Failed to stop local audio track during cleanup:", err);
        }
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }

      const existingClient = clientRef.current;
      if (existingClient) {
        existingClient.removeAllListeners();
        existingClient.leave().catch((err) => {
          console.warn("Failed to leave Agora client during cleanup:", err);
        });
        clientRef.current = null;
      }
    };
  }, [channelName, token, uid, appId]);

  // Auto-start recording when both parties join
  useEffect(() => {
    const startRecording = async () => {
      if (remoteUsers.length > 0 && recordingStatus === 'not_started' && isProvider) {
        console.log("🎥 Both parties joined, starting recording...");
        setRecordingStatus('starting');
        
        try {
          const { data, error } = await supabase.functions.invoke('start-video-recording', {
            body: { sessionId }
          });

          if (error) throw error;

          setRecordingStatus('active');
          toast({
            title: "Recording Started",
            description: "This session is now being recorded"
          });
        } catch (error) {
          console.error("Failed to start recording:", error);
          setRecordingStatus('not_started');
          toast({
            title: "Recording Failed",
            description: "Could not start recording. Please try manually.",
            variant: "destructive"
          });
        }
      }
    };

    startRecording();
  }, [remoteUsers.length, recordingStatus, isProvider, sessionId]);

  const stopRecording = async () => {
    setRecordingStatus('stopping');
    
    try {
      const { data, error } = await supabase.functions.invoke('stop-video-recording', {
        body: { sessionId }
      });

      if (error) throw error;

      setRecordingStatus('stopped');
      toast({
        title: "Recording Stopped",
        description: "The recording has been saved"
      });
    } catch (error) {
      console.error("Failed to stop recording:", error);
      toast({
        title: "Stop Recording Failed",
        description: "Could not stop recording",
        variant: "destructive"
      });
      setRecordingStatus('active');
    }
  };

  const toggleMute = () => {
    if (localAudioTrack) {
      localAudioTrack.setEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localVideoTrack) {
      localVideoTrack.setEnabled(isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  const startScreenShare = async () => {
    try {
      if (!client) {
        toast({
          title: "Not Connected",
          description: "Client not initialized",
          variant: "destructive",
        });
        return;
      }

      const screenVideoTrack = await AgoraRTC.createScreenVideoTrack(
        {
          encoderConfig: "1080p_1",
          optimizationMode: "detail",
        },
        "auto"
      );

      // Only unpublish if video track exists
      if (localVideoTrack) {
        await localVideoTrack.setEnabled(false);
        await client.unpublish([localVideoTrack]);
      }
      
      await client.publish([screenVideoTrack as ILocalVideoTrack]);
      const castedTrack = screenVideoTrack as ILocalVideoTrack;
      screenTrackRef.current = castedTrack;
      setScreenTrack(castedTrack);
      setIsScreenSharing(true);

      (screenVideoTrack as ILocalVideoTrack).on("track-ended", () => {
        stopScreenShare();
      });

      await supabase.from("video_session_logs").insert({
        session_id: sessionId,
        event_type: "screen_share_started",
        user_type: isProvider ? "provider" : "patient",
        event_data: {
          started_at: new Date().toISOString(),
          resolution: "1920x1080",
        },
      });

      toast({
        title: "Screen Sharing",
        description: "You are now sharing your screen",
      });
    } catch (error: any) {
      console.error("Screen share error:", error);
      setIsScreenSharing(false);
      
      if (error.message?.includes("Permission denied") || error.message?.includes("denied")) {
        toast({
          title: "Permission Denied",
          description: "Screen sharing permission was denied",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Screen Share Failed",
          description: "Failed to start screen sharing",
          variant: "destructive",
        });
      }
    }
  };

  const stopScreenShare = async () => {
    try {
      if (!client) return;

      if (screenTrack) {
        screenTrack.close();
        screenTrackRef.current = null;
        await client.unpublish([screenTrack]);
      }
      
      if (localVideoTrack) {
        await localVideoTrack.setEnabled(true);
        await client.publish([localVideoTrack]);
      }

      setScreenTrack(null);
      setIsScreenSharing(false);

      await supabase.from("video_session_logs").insert({
        session_id: sessionId,
        event_type: "screen_share_stopped",
        user_type: isProvider ? "provider" : "patient",
        event_data: { stopped_at: new Date().toISOString() },
      });

      toast({
        title: "Screen Sharing Stopped",
        description: "You are no longer sharing your screen",
      });
    } catch (error) {
      console.error("Stop screen share failed:", error);
      toast({
        title: "Error",
        description: "Failed to stop screen sharing",
        variant: "destructive",
      });
    }
  };

  const handleLeave = async () => {
    resetSessionState();
    await cleanupClientConnections();
    onLeave();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hrs = Math.floor(mins / 60);
    
    if (hrs > 0) {
      return `${hrs}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Debug Panel - Shows App ID mismatch diagnostics (DEV only) */}
      {import.meta.env.DEV && (
        <div className="absolute top-20 left-4 z-50 bg-black/90 text-white p-4 rounded-lg text-xs font-mono space-y-1 max-w-md">
          <div className="font-bold text-yellow-400 mb-2">🔍 DEBUG INFO</div>
          <div><span className="text-gray-400">FE App ID:</span> {appId}</div>
          <div><span className="text-gray-400">Channel:</span> {channelName}</div>
          <div><span className="text-gray-400">UID:</span> {String(uid)}</div>
          <div><span className="text-gray-400">Token Prefix:</span> {token.substring(0, 30)}...</div>
          {backendEcho && (
            <>
              <div className="mt-2 border-t border-gray-700 pt-2">
                <span className="text-gray-400">BE App ID Sample:</span> {backendEcho.appIdSample}
              </div>
              <div><span className="text-gray-400">BE Cert8:</span> {backendEcho.cert8}</div>
            </>
          )}
          
          {/* RTC Error Display */}
          {(rtcErrorCode || rtcErrorMessage) && (
            <>
              <div className="mt-2 border-t border-red-700 pt-2">
                <div className="font-bold text-red-400 mb-1">🚨 RTC ERROR</div>
              </div>
              {rtcErrorCode && <div><span className="text-gray-400">RTC Error Code:</span> <span className="text-red-300">{rtcErrorCode}</span></div>}
              {rtcErrorMessage && <div><span className="text-gray-400">RTC Error Message:</span> <span className="text-red-300">{rtcErrorMessage}</span></div>}
            </>
          )}
          
          {/* RTM Error Display */}
          {(chat.rtmErrorCode || chat.rtmErrorMessage) && (
            <>
              <div className="mt-2 border-t border-red-700 pt-2">
                <div className="font-bold text-red-400 mb-1">🚨 RTM ERROR</div>
              </div>
              {chat.rtmErrorCode && <div><span className="text-gray-400">RTM Error Code:</span> <span className="text-red-300">{chat.rtmErrorCode}</span></div>}
              {chat.rtmErrorMessage && <div><span className="text-gray-400">RTM Error Message:</span> <span className="text-red-300">{chat.rtmErrorMessage}</span></div>}
            </>
          )}
          
          <div className="text-xs text-gray-500 mt-2">
            FE & BE App IDs must match exactly
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="h-16 border-b bg-card px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {recordingStatus === 'active' && (
            <div className="flex items-center gap-2 text-destructive">
              <Circle className="h-3 w-3 fill-current animate-pulse" />
              <span className="text-sm font-medium">RECORDING</span>
            </div>
          )}
          {remoteUsers.length === 0 && recordingStatus !== 'active' && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Circle className="h-3 w-3" />
              <span className="text-sm font-medium">Waiting for participants...</span>
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            Duration: {formatDuration(sessionDuration)}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <NetworkQualityIndicator quality={quality.downlinkQuality} label="Download" />
          <NetworkQualityIndicator quality={quality.uplinkQuality} label="Upload" />
        </div>
        
        {isProvider && (
          <div className="flex items-center gap-2">
            {(recordingStatus === 'active' || recordingStatus === 'stopping') && (
              <Button
                size="sm"
                variant="outline"
                onClick={stopRecording}
                disabled={recordingStatus === 'stopping'}
                className="gap-2"
              >
                {recordingStatus === 'stopping' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Circle className="h-4 w-4" />
                    Stop Recording
                  </>
                )}
              </Button>
            )}
            <Button
              size="lg"
              variant="destructive"
              onClick={handleLeave}
              className="gap-2"
            >
              <PhoneOff className="h-5 w-5" />
              End Session
            </Button>
          </div>
        )}
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Remote User Video (Main) */}
        {remoteUsers.map(user => (
          <Card key={user.uid} className="relative overflow-hidden bg-black">
            <div
              id={`remote-player-${user.uid}`}
              className="w-full h-full"
              ref={(ref) => {
                if (ref && user.videoTrack) {
                  user.videoTrack.play(ref);
                }
              }}
            />
          </Card>
        ))}

        {/* Local Video */}
        <Card className="relative overflow-hidden bg-black">
          <div
            id="local-player"
            className="w-full h-full"
          />
          <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded-lg text-white text-sm">
            You {isProvider && "(Provider)"}
          </div>
          <div className="absolute top-4 left-4">
            <NetworkQualityIndicator quality={quality.uplinkQuality} label="Your Connection" />
          </div>
        </Card>

        {remoteUsers.length === 0 && (
          <Card className="flex items-center justify-center bg-muted">
            <div className="text-center text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Waiting for other participant...</p>
            </div>
          </Card>
        )}
      </div>

      {/* Controls */}
      <div className="h-20 border-t bg-card px-4 flex items-center justify-center gap-4">
        <Button
          size="lg"
          variant={isMuted ? "destructive" : "outline"}
          onClick={toggleMute}
          className="h-14 w-14 rounded-full p-0"
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>

        <Button
          size="lg"
          variant={isVideoOff ? "destructive" : "outline"}
          onClick={toggleVideo}
          className="h-14 w-14 rounded-full p-0"
        >
          {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
        </Button>

        <div className="flex flex-col items-center gap-1">
          <Button
            size="lg"
            variant={isScreenSharing ? "default" : "outline"}
            className="h-14 w-14 rounded-full p-0"
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          >
            <MonitorUp className="h-6 w-6" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {isScreenSharing ? "Stop Sharing" : "Share Screen"}
          </span>
        </div>

        {rtmToken && (
          <Button
            size="lg"
            variant={showChat ? "default" : "outline"}
            className="h-14 w-14 rounded-full p-0"
            onClick={() => setShowChat(!showChat)}
            title="Toggle chat"
          >
            <MessageSquare className="h-6 w-6" />
          </Button>
        )}

        {!isProvider && (
          <Button
            size="lg"
            variant="destructive"
            onClick={handleLeave}
            className="h-14 px-6 gap-2"
          >
            <PhoneOff className="h-5 w-5" />
            Leave
          </Button>
        )}
      </div>

      {/* Chat Panel */}
      {showChat && rtmToken && (
        <VideoChatPanel
          messages={chat.messages}
          onSendMessage={chat.sendMessage}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
};
