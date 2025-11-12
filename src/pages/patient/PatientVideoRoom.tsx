import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";

const PatientVideoRoom = () => {
  const { sessionId } = useParams();
  const { user } = useAuth();

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
    if (!user || !channelName) {
      console.error("[PatientVideoRoom] Missing user or channel.");
      return;
    }

    let isMounted = true;

    const fetchToken = async () => {
      try {
        setLoading(true);

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agora-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.access_token}`,
          },
          body: JSON.stringify({
            channel: channelName,
            role: "subscriber",
            ttl: 3600,
          }),
        });

        const data = await res.json();
        console.log("[PatientVideoRoom] Token Response:", data);

        if (!isMounted) return;

        if (!data.ok) {
          console.error("[PatientVideoRoom] Token error:", data.error);
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
  }, [channelName, user]);

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
      rtcToken={rtcToken}
      rtmToken={rtmToken}
      uid={uid}
      rtmUid={rtmUid}
      role="subscriber"
      userType="patient"
    />
  );
};

export default PatientVideoRoom;
