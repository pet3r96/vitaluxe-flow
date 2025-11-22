import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { supabase } from "@/integrations/supabase/client";
import { normalizeChannel } from "@/lib/video/normalizeChannel";
import { PreCallTestPrompt } from "@/components/video/PreCallTestPrompt";
import { logger } from "@/lib/logger";

const VideoConsultationRoom = () => {
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

  logger.info('Video consultation room initialized', logger.sanitize({ sessionId }));

  useEffect(() => {
    if (!sessionId) {
      logger.error('Missing session ID for video consultation');
      return;
    }

    let isMounted = true;

    const initializeSession = async () => {
      try {
        setLoading(true);

        // Fetch channel name + patient ID
        const { data: session, error: sessionError } = await supabase
          .from("video_sessions")
          .select("channel_name, status, patient_id")
          .eq("id", sessionId)
          .single();

        if (!isMounted) return;

        if (sessionError || !session) {
          let errorMsg = "Session not found";
          if (sessionError?.code === 'PGRST116') {
            errorMsg = "This video session no longer exists.";
          } else if (sessionError?.message?.includes('JWT')) {
            errorMsg = "Your session expired. Please sign in again.";
          } else if (sessionError) {
            errorMsg = `Database error: ${sessionError.message}`;
          }
          setError(errorMsg);
          return;
        }

        const normalized = normalizeChannel(session.channel_name);
        setChannelName(normalized);
        setPatientId(session.patient_id);

        // Fetch Agora tokens with timeout
        const tokenTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Token request timed out")), 10000)
        );

        // Verify authentication before requesting tokens
        const { data: { session: authSession } } = await supabase.auth.getSession();

        if (!authSession) {
          logger.error('No Supabase session available before calling agora-token');
          setError("You must be logged in to join video sessions.");
          return;
        }

        logger.info('Auth attached. User:', { userId: authSession.user.id });

        const tokenRequest = supabase.functions.invoke("agora-token", {
          headers: { 
            Authorization: `Bearer ${authSession.access_token}` 
          },
          body: {
            channel: normalized,
            role: "publisher",
            ttl: 3600,
          },
        });

        const { data, error } = await Promise.race([tokenRequest, tokenTimeout]) as any;

        if (!isMounted) return;

        if (error || !data) {
          let errorMsg = "Failed to generate access token";
          if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
            errorMsg = "Your session expired. Please sign in again.";
          } else if (error?.message?.includes('timeout')) {
            errorMsg = "Connection timed out. Please check your internet and try again.";
          } else if (error) {
            errorMsg = `Token generation failed: ${error.message}`;
          }
          setError(errorMsg);
          return;
        }

        // Validate App ID before using it
        if (!data.appId || data.appId.trim() === '') {
          logger.error('Invalid App ID received from backend', { 
            appId: data.appId,
            appIdType: typeof data.appId 
          });
          setError("Backend configuration error: Invalid Agora App ID. Please contact support.");
          return;
        }

        logger.info('Valid credentials received', {
          appId: data.appId,
          hasRtcToken: !!data.rtcToken,
          hasRtmToken: !!data.rtmToken
        });

        setAppId(data.appId);
        setRtcToken(data.rtcToken);
        setRtmToken(data.rtmToken);
        setUid(data.uid);
        setRtmUid(data.rtmUid);
        setTokenExpiresAt(data.expiresAt);
      } catch (err) {
        if (!isMounted) return;
        
        let errorMsg = "Unable to join video session";
        if (err instanceof Error) {
          if (err.message.includes('timeout')) {
            errorMsg = "Connection timed out. Please check your internet and try again.";
          } else if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
            errorMsg = "Network error. Please check your connection.";
          } else {
            errorMsg = err.message;
          }
        }
        setError(errorMsg);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeSession();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <div className="text-destructive text-lg font-semibold">Failed to Join Video Session</div>
        <div className="text-muted-foreground text-sm max-w-md text-center">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (loading || !rtcToken || !rtmToken || !uid || !rtmUid || !patientId || !appId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading secure video room…</div>
      </div>
    );
  }

  return (
    <>
      {/* Pre-call test prompt (top center) */}
      <PreCallTestPrompt sessionId={sessionId!} />

      {/* Actual video room */}
      <AgoraVideoRoom
        appId={appId}
        channelName={channelName!}
        rtcToken={rtcToken}
        rtmToken={rtmToken}
        uid={uid}
        rtmUid={rtmUid}
        role="publisher"
        userType="practice"
        sessionId={sessionId!}
        patientId={patientId!}
        tokenExpiresAt={tokenExpiresAt}
      />
    </>
  );
};

export default VideoConsultationRoom;
