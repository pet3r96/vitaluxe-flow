import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { supabase } from "@/integrations/supabase/client";
import { normalizeChannel } from "@/lib/video/normalizeChannel";
import { PreCallTestPrompt } from "@/components/video/PreCallTestPrompt";

const VideoGuestJoin = () => {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestData, setGuestData] = useState<any>(null);
  const [rtcToken, setRtcToken] = useState<string | null>(null);
  const [rtmToken, setRtmToken] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [rtmUid, setRtmUid] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initGuest = async () => {
      try {
        // For now, guest links are not implemented - show error message
        setError("Guest video links are not yet available. Please contact your provider for access.");
      } catch (e: any) {
        setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initGuest();

    return () => {
      mounted = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Checking guest access…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <div className="text-destructive text-lg font-semibold">Unable to Join Call</div>
        <p className="text-muted-foreground text-sm max-w-md text-center">{error}</p>
      </div>
    );
  }

  // Guest feature not implemented - this won't render
  return null;
};

export default VideoGuestJoin;
