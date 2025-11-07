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

        // Create and publish local tracks
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        
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
      const screenVideoTrack = await AgoraRTC.createScreenVideoTrack(
        {
          encoderConfig: "1080p_1",
          optimizationMode: "detail",
        },
        "auto"
      );

      await localVideoTrack?.setEnabled(false);
      await client?.unpublish([localVideoTrack!]);
      await client?.publish([screenVideoTrack as ILocalVideoTrack]);

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
    } catch (error) {
      console.error("Screen share error:", error);
      toast({
        title: "Screen share failed",
        variant: "destructive",
      });
    }
  };

  const stopScreenShare = async () => {
    if (screenTrack) {
      screenTrack.close();
      await client?.unpublish([screenTrack]);
      setScreenTrack(null);
      setIsScreenSharing(false);

      await localVideoTrack?.setEnabled(true);
      await client?.publish([localVideoTrack!]);

      await supabase.from("video_session_logs").insert({
        session_id: sessionId,
        event_type: "screen_share_stopped",
        user_type: isProvider ? "provider" : "patient",
        event_data: { stopped_at: new Date().toISOString() },
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
          <div className="flex items-center gap-2 text-destructive">
            <Circle className="h-3 w-3 fill-current animate-pulse" />
            <span className="text-sm font-medium">RECORDING</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Duration: {formatDuration(sessionDuration)}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <NetworkQualityIndicator quality={quality.downlinkQuality} label="Download" />
          <NetworkQualityIndicator quality={quality.uplinkQuality} label="Upload" />
        </div>
        
        {isProvider && (
          <Button
            size="lg"
            variant="destructive"
            onClick={handleLeave}
            className="gap-2"
          >
            <PhoneOff className="h-5 w-5" />
            End Session
          </Button>
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

        <Button
          size="lg"
          variant={isScreenSharing ? "destructive" : "outline"}
          className="h-14 w-14 rounded-full p-0"
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          title={isScreenSharing ? "Stop screen share" : "Share screen"}
        >
          <MonitorUp className="h-6 w-6" />
        </Button>

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
