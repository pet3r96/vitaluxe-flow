// 🧹 TODO AGORA REFACTOR
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { DeviceTestScreen } from "@/components/video/DeviceTestScreen";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { VideoDiagnostics } from "@/components/video/VideoDiagnostics";
import { useVideoPreflight } from "@/hooks/useVideoPreflight";
import { useVideoErrorLogger } from "@/hooks/useVideoErrorLogger";
import { Button } from "@/components/ui/button";

export default function VideoConsultationRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeviceTest, setShowDeviceTest] = useState(false);
  const { diagnostics, runPingTest, runHealthCheck, runJoinAttempt, clearDiagnostics } = useVideoPreflight();
  const { logVideoError } = useVideoErrorLogger();

  useEffect(() => {
    const joinSession = async () => {
      if (!sessionId) {
        setError("Session ID is required");
        setLoading(false);
        return;
      }

      clearDiagnostics();

      try {
        // Step 1: Ping test
        const pingSuccess = await runPingTest();
        if (!pingSuccess) {
          setError('Cannot reach backend servers. Please check your internet connection.');
          setLoading(false);
          toast({
            title: "Connection Error",
            description: "Unable to reach backend",
            variant: "destructive",
          });
          return;
        }

        // Step 2: Health check
        const { success: healthSuccess } = await runHealthCheck();
        if (!healthSuccess) {
          setError('Video system configuration error. Please contact support.');
          setLoading(false);
          toast({
            title: "Configuration Error",
            description: "Invalid video system setup",
            variant: "destructive",
          });
          return;
        }

        // Step 3: Join session
        console.log(`🔗 Joining video session:`, sessionId);
        
        const { success, data, error: joinError } = await runJoinAttempt(
          'join-video-session',
          { sessionId }
        );

        if (!success || joinError) {
          throw joinError || new Error('Failed to join session');
        }

        console.log("RAW BACKEND TOKEN RESPONSE:", data);

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
        
        const errorDetails = {
          sessionId: sessionId || 'unknown',
          errorCode: err.code || 'JOIN_ERROR',
          errorMessage: err.message || 'Unknown error',
          errorName: err.name || 'Error',
          joinParams: {
            appIdSample: 'provider',
            channelName: sessionId || 'unknown',
            uid: 'provider',
            tokenPreview: 'N/A',
            isProvider: true,
          },
        };

        await logVideoError(errorDetails);
        
        const errorMessage = err.message || "Failed to join video session";
        
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
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-destructive">Connection Failed</h2>
            <p className="text-muted-foreground">{error || "Unable to join video session"}</p>
            
            {diagnostics.length > 0 && <VideoDiagnostics results={diagnostics} />}
            
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    clearDiagnostics();
                    await runPingTest();
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Run Ping Test
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="flex-1"
                >
                  Try Again
                </Button>
              </div>
              <Button
                onClick={() => navigate('/practice-calendar')}
                className="w-full"
              >
                Return to Calendar
              </Button>
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
      tokenExpiry={sessionData.expiresAt}
    />
  );
}
