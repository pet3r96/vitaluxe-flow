import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { supabase } from "@/integrations/supabase/client";
import { normalizeChannel } from "@/lib/video/normalizeChannel";
import { PreCallTestPrompt } from "@/components/video/PreCallTestPrompt";
import { logger } from "@/lib/logger";

const PatientVideoRoom = () => {
  const { sessionId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rtcToken, setRtcToken] = useState<string | null>(null);
  const [rtmToken, setRtmToken] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [rtmUid, setRtmUid] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);

  logger.info("[PatientVideoRoom] Session ID", { sessionId });

  useEffect(() => {
    if (!sessionId) {
      logger.error("[PatientVideoRoom] Missing session ID");
      return;
    }

    let mounted = true;

    const init = async () => {
      try {
        setLoading(true);

        const { data: session, error: sessionError } = await supabase
          .from("video_sessions")
          .select("channel_name, patient_id")
          .eq("id", sessionId)
          .single();

        if (!mounted) return;

        if (sessionError || !session) {
          setError(sessionError?.message ?? "Video session not found.");
          return;
        }

        const normalized = normalizeChannel(session.channel_name);
        setChannelName(normalized);
        setPatientId(session.patient_id);

        // Verify authentication before requesting tokens
        const { data: { session: authSession } } = await supabase.auth.getSession();

        if (!authSession) {
          logger.error('[PatientVideoRoom] No Supabase session available');
          setError("You must be logged in to join video sessions.");
          return;
        }

        logger.info('[PatientVideoRoom] Auth attached. User:', { userId: authSession.user.id });

        // Patient always joins as subscriber (view-only), not publisher
        const { data, error } = await supabase.functions.invoke("agora-token", {
          headers: { 
            Authorization: `Bearer ${authSession.access_token}` 
          },
          body: {
            channel: normalized,
            role: "subscriber",
            ttl: 3600,
          },
        });

        if (!mounted) return;

        if (error || !data) {
          setError(error?.message ?? "Failed to fetch video credentials.");
          return;
        }

        // Validate App ID before using it
        if (!data.appId || data.appId.trim() === '') {
          logger.error('[PatientVideoRoom] Invalid App ID received from backend', { 
            appId: data.appId,
            appIdType: typeof data.appId 
          });
          setError("Backend configuration error: Invalid Agora App ID. Please contact support.");
          return;
        }

        logger.info('[PatientVideoRoom] Valid credentials received', {
          appId: data.appId,
          hasRtcToken: !!data.rtcToken,
          hasRtmToken: !!data.rtmToken
        });

        console.log('🟢 [PatientVideoRoom] Received from backend:', {
          appId: data.appId,
          appIdFormat: /^[a-f0-9]{32}$/.test(data.appId) ? 'valid' : 'invalid',
          timestamp: new Date().toISOString()
        });

        setAppId(data.appId);
        setRtcToken(data.rtcToken);
        setRtmToken(data.rtmToken);
        setUid(data.uid);
        setRtmUid(data.rtmUid);
        setTokenExpiresAt(data.expiresAt);
      } catch (e: any) {
        setError(e?.message ?? "Unexpected error occurred.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <div className="text-destructive text-lg font-semibold">Unable to Join Video Session</div>
        <p className="text-muted-foreground text-sm max-w-md text-center">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (loading || !appId || !rtcToken || !rtmToken || !uid || !rtmUid || !patientId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Joining secure patient video room…</div>
      </div>
    );
  }

  return (
    <>
      {/* Pre-call test prompt */}
      <PreCallTestPrompt sessionId={sessionId!} />

      <AgoraVideoRoom
        appId={appId!}
        channelName={channelName!}
        rtcToken={rtcToken}
        rtmToken={rtmToken}
        uid={uid}
        rtmUid={rtmUid}
        role="subscriber"
        userType="patient"
        sessionId={sessionId!}
        patientId={patientId!}
        tokenExpiresAt={tokenExpiresAt}
      />
    </>
  );
};

export default PatientVideoRoom;
