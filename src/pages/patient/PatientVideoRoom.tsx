import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { DeviceTestScreen } from "@/components/video/DeviceTestScreen";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PatientVideoRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [waitingForProvider, setWaitingForProvider] = useState(false);
  const [showDeviceTest, setShowDeviceTest] = useState(false);
  
  // Compute channel name from sessionId
  const channelName = sessionId ? `vlx_${sessionId.replace(/-/g, '_')}` : '';
  const appId = import.meta.env.VITE_AGORA_APP_ID as string;

  // 🧹 TODO AGORA REFACTOR: Fetch user ID and check session status
  useEffect(() => {
    const initialize = async () => {
      if (!sessionId) {
        setLoading(false);
        toast({
          title: "Error",
          description: "Session ID is required",
          variant: "destructive",
        });
        return;
      }

      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast({
            title: "Authentication Required",
            description: "Please log in to join the session",
            variant: "destructive",
          });
          navigate('/auth');
          return;
        }

        setUserId(user.id);

        // Check session status
        const { data: session } = await supabase
          .from('video_sessions')
          .select('status')
          .eq('id', sessionId)
          .single();

        if (session?.status === 'waiting') {
          setWaitingForProvider(true);
        } else {
          setShowDeviceTest(true);
        }
      } catch (err: any) {
        console.error("Error initializing session:", err);
        toast({
          title: 'Connection Error',
          description: err.message || 'Failed to initialize session',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [sessionId, navigate, toast]);

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

  if (loading || !userId) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <Card className="p-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Initializing session...</p>
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
        appId={appId}
        onComplete={() => setShowDeviceTest(false)}
      />
    );
  }

  return (
    <AgoraVideoRoom
      channelName={channelName}
      token="" // 🧹 TODO AGORA REFACTOR: Hook fetches token automatically
      uid={userId}
      appId={appId}
      onLeave={handleLeave}
      isProvider={false}
      sessionId={sessionId!}
      rtmToken="" // 🧹 TODO AGORA REFACTOR: RTM to be re-integrated
      rtmUid=""
      userName="Patient"
    />
  );
}
