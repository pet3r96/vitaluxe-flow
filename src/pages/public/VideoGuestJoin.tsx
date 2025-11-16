import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import TelehealthRoomUnified from "@/components/video/TelehealthRoomUnified";
import { PreCallTestPrompt } from "@/components/video/PreCallTestPrompt";
import { Loader2 } from "lucide-react";

const VideoGuestJoin = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<{
    sessionId: string;
    channelName: string;
    appId: string;
    rtcToken: string;
    rtmToken: string;
    uid: string;
    rtmUid: string;
    guestName: string;
    practiceName: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    const validateGuestToken = async () => {
      if (!token) {
        setError("Invalid guest link");
        setLoading(false);
        return;
      }

      try {
        console.log('[VideoGuestJoin] Validating guest token:', token.substring(0, 8) + '...');

        const { data, error: fnError } = await supabase.functions.invoke(
          'validate-video-guest-token',
          {
            body: { token },
          }
        );

        if (fnError) {
          console.error('[VideoGuestJoin] Validation error:', fnError);
          throw new Error(fnError.message || 'Failed to validate guest link');
        }

        if (!data.success) {
          console.error('[VideoGuestJoin] Validation failed:', data.error);
          
          // Handle different error types
          if (data.error === 'expired') {
            setError('This guest link has expired. Please contact your provider for a new link.');
          } else if (data.error === 'invalid') {
            setError('This guest link is invalid. Please check the URL or contact your provider.');
          } else if (data.error === 'session_ended') {
            setError('This video session has ended. Please contact your provider if you need assistance.');
          } else {
            setError(data.message || 'Unable to join video session');
          }
          setLoading(false);
          return;
        }

        console.log('[VideoGuestJoin] Guest validated successfully');

        if (mounted) {
          setSessionData({
            sessionId: data.sessionId,
            channelName: data.channelName,
            appId: data.appId,
            rtcToken: data.rtcToken,
            rtmToken: data.rtmToken,
            uid: data.uid,
            rtmUid: data.rtmUid,
            guestName: data.guest_name || 'Guest',
            practiceName: data.practice_name || 'Practice',
          });
          setLoading(false);
        }
      } catch (e: any) {
        console.error('[VideoGuestJoin] Error:', e);
        if (mounted) {
          setError(e.message || 'Failed to validate guest link');
          setLoading(false);
        }
      }
    };

    validateGuestToken();

    return () => {
      mounted = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Validating guest access...</p>
        </div>
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

  if (!sessionData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <PreCallTestPrompt sessionId={sessionData.sessionId} />
      <TelehealthRoomUnified
        sessionId={sessionData.sessionId}
        channel={sessionData.channelName}
        appId={sessionData.appId}
        token={sessionData.rtcToken}
        uid={sessionData.uid}
        isProvider={false}
        patientId="" // Guest has no patient ID
        isGuest={true}
      />
    </div>
  );
};

export default VideoGuestJoin;
