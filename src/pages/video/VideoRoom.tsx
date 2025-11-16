import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import TelehealthRoomUnified from "@/components/video/TelehealthRoomUnified";
import { PreCallTestPrompt } from "@/components/video/PreCallTestPrompt";

export default function VideoRoom() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Session data
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isProvider, setIsProvider] = useState(false);
  
  // Agora credentials
  const [appId, setAppId] = useState<string | null>(null);
  const [rtcToken, setRtcToken] = useState<string | null>(null);
  const [rtmToken, setRtmToken] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadActiveSession = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check auth
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession) {
          navigate("/auth");
          return;
        }

        // Get active session for this user
        const { data: sessionData, error: sessionError } = await supabase.functions.invoke(
          'get-active-video-session',
          { body: {} , headers: { Authorization: `Bearer ${authSession.access_token}` } }
        );

        if (sessionError) throw sessionError;

        if (!sessionData?.session) {
          if (isMounted) {
            setError("No active video session found. Please return to your dashboard.");
            setLoading(false);
          }
          return;
        }

        const { session: videoSession, isProvider: providerFlag } = sessionData;

        if (!isMounted) return;

        setSessionId(videoSession.id);
        setChannelName(videoSession.channelName);
        setPracticeId(videoSession.practiceId);
        setPatientId(videoSession.patientId);
        setIsProvider(providerFlag);

        // Get Agora tokens
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
          'agora-token',
          {
            body: {
              channel: videoSession.channelName,
              role: providerFlag ? 'publisher' : 'publisher', // Both can publish
              ttl: 3600
            }
          }
        );

        if (tokenError) throw tokenError;

        if (!tokenData?.ok) {
          throw new Error(tokenData?.error || 'Failed to generate Agora tokens');
        }

        if (!isMounted) return;

        setAppId(tokenData.appId);
        setRtcToken(tokenData.rtcToken);
        setRtmToken(tokenData.rtmToken);
        setUid(tokenData.uid);
        setLoading(false);

      } catch (err: any) {
        console.error('[VideoRoom] Error loading session:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load video session');
          setLoading(false);
        }
      }
    };

    loadActiveSession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4 max-w-md p-8">
          <h2 className="text-2xl font-semibold text-destructive">Unable to Join Video Session</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => navigate("/dashboard")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (loading || !sessionId || !channelName || !appId || !rtcToken || !rtmToken || !uid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading video session...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PreCallTestPrompt sessionId={sessionId} />
      <TelehealthRoomUnified
        appId={appId}
        token={rtcToken}
        channel={channelName}
        uid={uid}
        sessionId={sessionId}
        patientId={patientId || ''}
        isProvider={isProvider}
      />
    </>
  );
}
