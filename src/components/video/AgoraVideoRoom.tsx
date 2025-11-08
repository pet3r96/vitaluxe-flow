import { useState, useEffect } from "react";
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

  const quality = useNetworkQuality(client, sessionId);
  
  const chat = rtmToken && rtmUid ? useVideoChat({
    appId,
    rtmToken,
    rtmUid,
    channelName,
    sessionId,
    userName,
    userType: isProvider ? "provider" : "patient",
  }) : { messages: [], sendMessage: async () => {}, isConnected: false };

  useEffect(() => {
    const initClient = async () => {
      try {
        const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        setClient(agoraClient);

        // Event handlers
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

        // Join channel
        await agoraClient.join(appId, channelName, token, uid);

        // Read device preferences from localStorage
        const prefs = JSON.parse(localStorage.getItem("video.devicePrefs") || "{}");
        console.log("📱 Using device preferences:", prefs);

        // Create and publish local tracks with preferred devices
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
        
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);

        await agoraClient.publish([audioTrack, videoTrack]);

        // Play local video
        videoTrack.play("local-player");

        // Adaptive bitrate based on network quality
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

      } catch (error) {
        console.error("Error initializing Agora:", error);
        toast({
          title: "Connection Error",
          description: "Failed to join video session",
          variant: "destructive"
        });
      }
    };

    initClient();

    // Session timer
    const timer = setInterval(() => {
      setSessionDuration(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      localVideoTrack?.close();
      localAudioTrack?.close();
      client?.leave();
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
      setScreenTrack(screenVideoTrack as ILocalVideoTrack);
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
    localVideoTrack?.close();
    localAudioTrack?.close();
    screenTrack?.close();
    await client?.leave();
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
