import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { DeviceTestScreen } from "@/components/video/DeviceTestScreen";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function VideoConsultationRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeviceTest, setShowDeviceTest] = useState(false);

  useEffect(() => {
    const joinSession = async (retryCount = 0) => {
      if (!sessionId) {
        setError("Session ID is required");
        setLoading(false);
        return;
      }

      try {
        console.log(`🔗 [Attempt ${retryCount + 1}] Joining video session:`, sessionId);
        
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 15000)
        );

        const invokePromise = supabase.functions.invoke('join-video-session', {
          body: { sessionId }
        });

        const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as any;

        console.log("📡 Join session response:", { data, error });

        if (error) {
          console.error("❌ Join session error:", error);
          
          // Map specific errors to user-friendly messages
          let friendlyMessage = "Failed to connect to video session";
          if (error.message?.includes("not found")) {
            friendlyMessage = "This video session no longer exists";
          } else if (error.message?.includes("token")) {
            friendlyMessage = "Unable to generate video credentials";
          } else if (error.message?.includes("unauthorized")) {
            friendlyMessage = "You don't have permission to join this session";
          }
          
          throw new Error(friendlyMessage);
        }

        if (!data) {
          throw new Error("No session data received from server");
        }

        if (!data.token || !data.channelName || !data.appId) {
          console.error("❌ Invalid session data:", data);
          throw new Error("Invalid session configuration received");
        }

        console.log("✅ Session joined successfully");
        setSessionData(data);
        setShowDeviceTest(true);
        setLoading(false);
        console.log("✅ UI ready: Device test screen should render now");
      } catch (err: any) {
        console.error("❌ Error joining video session:", err);
        
        // Retry logic with exponential backoff
        if (retryCount < 2 && err.message !== 'timeout') {
          const delay = retryCount === 0 ? 2000 : 5000;
          console.log(`🔄 Retrying in ${delay}ms...`);
          
          toast({
            title: "Still connecting...",
            description: `Retry attempt ${retryCount + 2} of 3`,
          });
          
          setTimeout(() => joinSession(retryCount + 1), delay);
          return;
        }
        
        // Final failure
        const errorMessage = err.message === 'timeout'
          ? "Connection timeout. Please check your internet and try again."
          : (err.message || "Failed to join video session");
        
        setError(errorMessage);
        toast({
          title: "Connection Failed",
          description: errorMessage,
          variant: "destructive"
        });
        setLoading(false);
      }
    };

    joinSession();
  }, [sessionId, toast]);

  // Safety guard: ensure loading is false when sessionData is set
  useEffect(() => {
    if (sessionData && loading) {
      setLoading(false);
    }
  }, [sessionData, loading]);

  const handleLeave = async () => {
    if (sessionId) {
      try {
        await supabase.functions.invoke('end-video-session', {
          body: { sessionId }
        });
      } catch (err) {
        console.error("Error ending session:", err);
      }
    }
    navigate('/practice-calendar');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <Card className="p-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Connecting to video session...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-destructive">Connection Failed</h2>
            <p className="text-muted-foreground">{error || "Unable to join video session"}</p>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="btn btn-outline w-full"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/practice-calendar')}
                className="btn btn-primary w-full"
              >
                Return to Calendar
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (showDeviceTest) {
    return (
      <DeviceTestScreen
        appId={sessionData.appId}
        onComplete={() => setShowDeviceTest(false)}
      />
    );
  }

  return (
    <AgoraVideoRoom
      channelName={sessionData.channelName}
      token={sessionData.token}
      uid={sessionData.uid}
      appId={sessionData.appId}
      onLeave={handleLeave}
      isProvider={true}
      sessionId={sessionId!}
      rtmToken={sessionData.rtmToken}
      rtmUid={sessionData.rtmUid}
      userName="Provider"
    />
  );
}
