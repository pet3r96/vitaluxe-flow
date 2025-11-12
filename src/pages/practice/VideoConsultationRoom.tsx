import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { useAuth } from "@/contexts/AuthContext";

const VideoConsultationRoom = () => {
  const { sessionId } = useParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rtcToken, setRtcToken] = useState<string | null>(null);
  const [rtmToken, setRtmToken] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [rtmUid, setRtmUid] = useState<string | null>(null);

  /** Safely compute channel name */
  const channelName = sessionId?.trim() ? `vlx_${sessionId.replace(/-/g, "_")}` : null;

  console.log("[PracticeVideoRoom] Channel:", {
    raw: sessionId,
    formatted: channelName,
  });

  useEffect(() => {
    if (!channelName || !user) {
      console.error("[PracticeVideoRoom] Missing channel or user.");
      return;
    }

    let isMounted = true;

    const fetchToken = async () => {
      try {
        setLoading(true);
        console.log("[PracticeVideoRoom] Fetching Agora tokens...");

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agora-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.access_token}`,
          },
          body: JSON.stringify({
            channel: channelName,
            role: "publisher",
            ttl: 3600,
          }),
        });

        const data = await res.json();
        console.log("[PracticeVideoRoom] Token Response:", data);

        if (!isMounted) return;

        if (!data.ok) {
          console.error("[PracticeVideoRoom] Token error:", data.error);
          return;
        }

        setRtcToken(data.rtcToken);
        setRtmToken(data.rtmToken);
        setUid(data.uid);
        setRtmUid(data.rtmUid);
      } catch (err) {
        console.error("[PracticeVideoRoom] Fetch token failed:", err);
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
    />
  );
};

export default VideoConsultationRoom;
