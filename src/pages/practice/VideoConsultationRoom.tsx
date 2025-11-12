import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { DeviceTestScreen } from "@/components/video/DeviceTestScreen";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VideoConsultationRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showDeviceTest, setShowDeviceTest] = useState(true);
  
  // Compute channel name from sessionId
  const channelName = sessionId ? `vlx_${sessionId.replace(/-/g, '_')}` : '';
  const appId = import.meta.env.VITE_AGORA_APP_ID as string;

  // 🧹 TODO AGORA REFACTOR: Fetch user ID
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
        console.log("✅ Provider ready to join session");
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
      isProvider={true}
      sessionId={sessionId!}
      rtmToken="" // 🧹 TODO AGORA REFACTOR: RTM to be re-integrated
      rtmUid=""
      userName="Provider"
    />
  );
}
