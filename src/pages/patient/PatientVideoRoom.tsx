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
  const [channelName, setChannelName] = useState<string | null>(null);

  console.log("[PatientVideoRoom] Session ID:", sessionId);

  useEffect(() => {
    if (!sessionId) {
      console.error("[PatientVideoRoom] Missing session ID.");
      return;
    }

    let isMounted = true;

    const initializeSession = async () => {
      try {
        setLoading(true);

        // Fetch channel name from video_sessions table
        console.log("[PatientVideoRoom] Fetching video session...");
        const { data: session, error: sessionError } = await supabase
          .from('video_sessions')
          .select('channel_name, status')
          .eq('id', sessionId)
          .single();

        if (!isMounted) return;

        if (sessionError || !session) {
          console.error("[PatientVideoRoom] Session fetch error:", sessionError);
          return;
        }

        console.log("[PatientVideoRoom] Session found:", session);
        const fetchedChannelName = session.channel_name;
        setChannelName(fetchedChannelName);

        // Fetch Agora tokens
        console.log("[PatientVideoRoom] Fetching Agora tokens for channel:", fetchedChannelName);

        const { data, error } = await supabase.functions.invoke('agora-token', {
          body: {
            channel: fetchedChannelName,
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
        console.error("[PatientVideoRoom] Initialization failed:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeSession();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

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
