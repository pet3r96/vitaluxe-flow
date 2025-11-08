import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { DeviceTestScreen } from "@/components/video/DeviceTestScreen";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Loader2, Video } from "lucide-react";

export default function PatientVideoRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitingForProvider, setWaitingForProvider] = useState(false);
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

        if (error) throw error;

        const sessionStatus = data.session?.status || data.session_status;
        if (sessionStatus === 'waiting') {
          setWaitingForProvider(true);
        } else {
          setShowDeviceTest(true);
        }

        setSessionData(data);
      } catch (err: any) {
        console.error("Error joining video session:", err);
        const message = err.message === 'timeout'
          ? 'Connection is taking longer than expected. Please try again.'
          : (err.message || 'Failed to join video session');
        setError(message);
        toast({
          title: err.message === 'timeout' ? 'Still connecting' : 'Connection Error',
          description: message,
          variant: err.message === 'timeout' ? undefined : 'destructive'
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
                onClick={() => navigate('/appointments')}
                className="btn btn-primary w-full"
              >
                Return to Appointments
              </button>
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
    />
  );
}
