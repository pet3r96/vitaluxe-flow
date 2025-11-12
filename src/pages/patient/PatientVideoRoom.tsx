// 🧹 TODO AGORA REFACTOR
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { DeviceTestScreen } from "@/components/video/DeviceTestScreen";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Loader2, Video } from "lucide-react";
import { VideoDiagnostics } from "@/components/video/VideoDiagnostics";
import { useVideoPreflight } from "@/hooks/useVideoPreflight";
import { useVideoErrorLogger } from "@/hooks/useVideoErrorLogger";
import { Button } from "@/components/ui/button";

export default function PatientVideoRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitingForProvider, setWaitingForProvider] = useState(false);
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
        const { success, data, error: joinError } = await runJoinAttempt(
          'join-video-session',
          { sessionId }
        );

        if (!success || joinError) {
          // Check if auth error
          if (joinError?.message?.includes('401') || joinError?.message?.includes('Unauthorized')) {
            setError('Session expired. Please log in again.');
            toast({
              title: "Authentication Required",
              description: "Your session has expired",
              variant: "destructive",
            });
          } else {
            throw joinError || new Error('Failed to join session');
          }
          setLoading(false);
          return;
        }

        console.log("RAW BACKEND TOKEN RESPONSE:", data);
        
        const sessionStatus = data.session?.status || data.session_status;

        if (sessionStatus === 'waiting') {
          setWaitingForProvider(true);
        } else {
          setShowDeviceTest(true);
        }

        setSessionData(data);
      } catch (err: any) {
        console.error("Error joining video session:", err);
        
        const errorDetails = {
          sessionId: sessionId || 'unknown',
          errorCode: err.code || 'JOIN_ERROR',
          errorMessage: err.message || 'Unknown error',
          errorName: err.name || 'Error',
          joinParams: {
            appIdSample: 'patient',
            channelName: sessionId || 'unknown',
            uid: 'patient',
            tokenPreview: 'N/A',
            isProvider: false,
          },
        };

        await logVideoError(errorDetails);

        const message = err.message || 'Failed to join video session';
        setError(message);
        toast({
          title: 'Connection Error',
          description: message,
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    joinSession();
  }, [sessionId, toast]);

  // Subscribe to session status changes
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`video_session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.new.status === 'active') {
            setWaitingForProvider(false);
            setShowDeviceTest(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const handleLeave = () => {
    navigate('/appointments');
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
                onClick={() => navigate('/appointments')}
                className="w-full"
              >
                Return to Appointments
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (waitingForProvider) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="text-center space-y-4">
            <Video className="h-16 w-16 mx-auto text-primary animate-pulse" />
            <h2 className="text-xl font-semibold">Waiting for Provider</h2>
            <p className="text-muted-foreground">
              Your provider will join the session shortly. Please wait...
            </p>
            <button
              onClick={handleLeave}
              className="btn btn-outline w-full"
            >
              Leave Session
            </button>
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
      isProvider={false}
      sessionId={sessionId!}
      rtmToken={sessionData.rtmToken}
      rtmUid={sessionData.rtmUid}
      userName="Patient"
      tokenExpiry={sessionData.expiresAt}
    />
  );
}
