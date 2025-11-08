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
    const joinSession = async () => {
      if (!sessionId) {
        setError("Session ID is required");
        setLoading(false);
        return;
      }

      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 12000)
        );

        const invokePromise = supabase.functions.invoke('join-video-session', {
          body: { sessionId }
        });

        const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as any;

        if (error) {
          console.error("Join session error:", error);
          throw new Error(error.message || "Failed to connect to video session");
        }

        if (!data) {
          throw new Error("No session data received");
        }

        if (!data.token || !data.channelName || !data.appId) {
          throw new Error("Invalid session data received");
        }

        setSessionData(data);
        setShowDeviceTest(true);
      } catch (err: any) {
        console.error("Error joining video session:", err);
        const errorMessage = err.message === 'timeout'
          ? "Connection is taking longer than expected. Please try again."
          : (err.message || "Failed to join video session");
        setError(errorMessage);
        toast({
          title: err.message === 'timeout' ? "Still connecting" : "Connection Error",
          description: errorMessage,
          variant: err.message === 'timeout' ? undefined : "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    joinSession();
  }, [sessionId, toast]);

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
