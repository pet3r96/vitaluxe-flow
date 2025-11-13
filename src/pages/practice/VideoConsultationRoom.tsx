import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { supabase } from "@/integrations/supabase/client";
import { normalizeChannel } from "@/lib/video/normalizeChannel";

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

  console.log("[PracticeVideoRoom] Session ID:", sessionId);

  useEffect(() => {
    if (!sessionId) {
      console.error("[PracticeVideoRoom] Missing session ID.");
      return;
    }

    let isMounted = true;

    const initializeSession = async () => {
      try {
        setLoading(true);

        // Fetch channel name from video_sessions table
        console.log("[PracticeVideoRoom] Fetching video session...");
        const { data: session, error: sessionError } = await supabase
          .from('video_sessions')
          .select('channel_name, status, patient_id')
          .eq('id', sessionId)
          .single();

        if (!isMounted) return;

        if (sessionError || !session) {
          const errorMsg = sessionError 
            ? `Database error: ${sessionError.message} (Code: ${sessionError.code})`
            : 'Session not found';
          console.error("[PracticeVideoRoom] Session fetch error:", {
            error: sessionError,
            errorMessage: sessionError?.message,
            errorCode: sessionError?.code,
            errorDetails: sessionError?.details,
            sessionId
          });
          setError(errorMsg);
          return;
        }

        console.log("[PracticeVideoRoom] Session found:", session);
        console.log('[VideoConsultationRoom] Raw channel from DB:', session?.channel_name);
        
        const normalized = normalizeChannel(session.channel_name);
        
        console.log('[VideoConsultationRoom] Normalized channel:', normalized);
        setChannelName(normalized);
        setPatientId(session.patient_id);

        // Fetch Agora tokens
        console.log("[PracticeVideoRoom] Fetching Agora tokens for channel:", normalized);

        const { data, error } = await supabase.functions.invoke('agora-token', {
          body: {
            channel: normalized,
            role: "publisher",
            ttl: 3600,
          }
        });

        console.log("[PracticeVideoRoom] Token Response:", data);

        if (!isMounted) return;

        if (error || !data) {
          const errorMsg = error 
            ? `Token generation failed: ${error.message}`
            : 'No token data received';
          console.error("[PracticeVideoRoom] Token error:", {
            error,
            errorMessage: error?.message,
            data
          });
          setError(errorMsg);
          return;
        }

        setRtcToken(data.rtcToken);
        setRtmToken(data.rtmToken);
        setUid(data.uid);
        setRtmUid(data.rtmUid);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error("[PracticeVideoRoom] Initialization failed:", {
          error: err,
          message: errorMsg,
          stack: err instanceof Error ? err.stack : undefined
        });
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

  if (loading || !rtcToken || !rtmToken || !uid || !rtmUid || !patientId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading secure video room…</div>
      </div>
    );
  }

  return (
    <AgoraVideoRoom
      channelName={channelName!}
      rtcToken={rtcToken}
      rtmToken={rtmToken}
      uid={uid}
      rtmUid={rtmUid}
      role="publisher"
      userType="practice"
      sessionId={sessionId!}
      patientId={patientId!}
    />
  );
};

export default VideoConsultationRoom;
