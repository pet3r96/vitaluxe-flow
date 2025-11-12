import { useState, useEffect } from "react";
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
import { useAgoraCall } from "@/hooks/useAgoraCall";

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
  tokenExpiry?: number; // Unix timestamp in seconds
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
  tokenExpiry,
}: AgoraVideoRoomProps) => {
  const { toast } = useToast();
  
  // Use new Agora hook for RTC
  const call = useAgoraCall({
    channel: channelName,
    userId: String(uid),
    appId,
    autoRenew: true
  });

  // UI state (preserved from original)
  const [sessionDuration, setSessionDuration] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<'not_started' | 'starting' | 'active' | 'stopping' | 'stopped'>('not_started');
  
  // 🧹 TODO AGORA REFACTOR: Re-enable these features with extended hook
  // const [isMuted, setIsMuted] = useState(false);
  // const [isVideoOff, setIsVideoOff] = useState(false);
  // const [isScreenSharing, setIsScreenSharing] = useState(false);
  // const [showChat, setShowChat] = useState(false);

  // Auto-join on mount
  useEffect(() => {
    let mounted = true;
    
    const joinCall = async () => {
      try {
        console.log("[AgoraVideoRoom] Joining call with new hook...");
        await call.join();
        
        if (mounted) {
          toast({
            title: "Connected",
            description: "You have joined the video consultation"
          });
        }
      } catch (error: any) {
        console.error("[AgoraVideoRoom] Join failed:", error);
        
        if (mounted) {
          toast({
            title: "Connection Error",
            description: error.message || "Failed to join video session",
            variant: "destructive"
          });
        }
      }
    };

    joinCall();

    return () => {
      mounted = false;
      call.leave();
    };
  }, [channelName, uid]);

  // 🧹 TODO AGORA REFACTOR: Chat/RTM functionality
  // const chat = (rtmToken && rtmUid && !skipRTM) ? useVideoChat({ ... }) : { ... };
  
  // Session duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 🧹 TODO AGORA REFACTOR: Auto-start recording when both parties join
  // Currently disabled - need remote user detection from hook
  // useEffect(() => { ... }, [call.isJoined, recordingStatus, isProvider, sessionId]);

  // 🧹 TODO AGORA REFACTOR: Recording controls
  // const stopRecording = async () => { ... };

  // 🧹 TODO AGORA REFACTOR: Mute/video controls - need track access from hook
  // const toggleMute = () => { ... };
  // const toggleVideo = () => { ... };

  // 🧹 TODO AGORA REFACTOR: Screen sharing - need extended hook support
  // const startScreenShare = async () => { ... };
  // const stopScreenShare = async () => { ... };

  const handleLeave = async () => {
    await call.leave();
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
      {/* Debug Panel */}
      {import.meta.env.DEV && (
        <div className="absolute top-20 left-4 z-50 bg-black/90 text-white p-4 rounded-lg text-xs font-mono space-y-1 max-w-md">
          <div className="font-bold text-yellow-400 mb-2">🔍 NEW HOOK DEBUG</div>
          <div><span className="text-gray-400">Channel:</span> {channelName}</div>
          <div><span className="text-gray-400">UID:</span> {String(uid)}</div>
          <div><span className="text-gray-400">Joined:</span> {call.isJoined ? '✅' : '⏳'}</div>
        </div>
      )}
      
      {/* Header */}
      <div className="h-16 border-b bg-card px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {call.isJoined ? (
            <div className="flex items-center gap-2 text-green-600">
              <Circle className="h-3 w-3 fill-current" />
              <span className="text-sm font-medium">Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Circle className="h-3 w-3" />
              <span className="text-sm font-medium">Connecting...</span>
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            Duration: {formatDuration(sessionDuration)}
          </div>
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
        {/* Remote User Video */}
        <Card className="relative overflow-hidden bg-black">
          <div
            ref={call.remoteVideoRef}
            className="w-full h-full"
          />
          <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded-lg text-white text-sm">
            Remote User
          </div>
        </Card>

        {/* Local Video */}
        <Card className="relative overflow-hidden bg-black">
          <div
            ref={call.localVideoRef}
            className="w-full h-full"
          />
          <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded-lg text-white text-sm">
            You {isProvider && "(Provider)"}
          </div>
        </Card>
      </div>

      {/* Controls */}
      <div className="h-20 border-t bg-card px-4 flex items-center justify-center gap-4">
        {/* 🧹 TODO AGORA REFACTOR: Re-enable with track controls from hook */}
        {/* <Button variant="outline" disabled><Mic /></Button> */}
        {/* <Button variant="outline" disabled><Video /></Button> */}
        {/* <Button variant="outline" disabled><MonitorUp /></Button> */}
        {/* <Button variant="outline" disabled><MessageSquare /></Button> */}

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

      {/* 🧹 TODO AGORA REFACTOR: Chat Panel - requires RTM integration */}
      {/* {showChat && rtmToken && <VideoChatPanel ... />} */}
    </div>
  );
};
