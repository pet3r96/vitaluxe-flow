import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { supabase } from "@/integrations/supabase/client";

const PatientVideoRoom = () => {
  const { sessionId } = useParams();

  const [loading, setLoading] = useState(true);
  const [rtcToken, setRtcToken] = useState<string | null>(null);
  const [rtmToken, setRtmToken] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [rtmUid, setRtmUid] = useState<string | null>(null);

  /** Safe channel formatting */
  const channelName = sessionId?.trim() ? `vlx_${sessionId.replace(/-/g, "_")}` : null;

  console.log("[PatientVideoRoom] Channel:", {
    raw: sessionId,
    formatted: channelName,
  });

  useEffect(() => {
    if (!channelName) {
      console.error("[PatientVideoRoom] Missing channel.");
      return;
    }

    let isMounted = true;

    const fetchToken = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase.functions.invoke('agora-token', {
          body: {
            channel: channelName,
            role: "subscriber",
            ttl: 3600,
          }
        });

        console.log("[PatientVideoRoom] Token Response:", data);

        if (!isMounted) return;

        if (error || !data) {
          console.error("[PatientVideoRoom] Token error:", error);
          return;
        }

        setRtcToken(data.rtcToken);
        setRtmToken(data.rtmToken);
        setUid(data.uid);
        setRtmUid(data.rtmUid);
      } catch (err) {
        console.error("[PatientVideoRoom] Fetch token failed:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchToken();

    return () => {
      isMounted = false;
    };
  }, [channelName]);

  if (loading || !rtcToken || !rtmToken || !uid || !rtmUid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Connecting to your secure visit…</div>
      </div>
    );
  }

  return (
    <AgoraVideoRoom
      channelName={channelName!}
      token={rtcToken}
      uid={uid}
      appId={import.meta.env.VITE_AGORA_APP_ID || ""}
      sessionId={sessionId!}
      rtmToken={rtmToken}
      rtmUid={rtmUid}
      isProvider={false}
      onLeave={() => window.history.back()}
    />
  );
};

export default PatientVideoRoom;
