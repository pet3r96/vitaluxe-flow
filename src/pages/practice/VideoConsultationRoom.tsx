import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { supabase } from "@/integrations/supabase/client";

const VideoConsultationRoom = () => {
  const { sessionId } = useParams();

  const [loading, setLoading] = useState(true);
  const [rtcToken, setRtcToken] = useState<string | null>(null);
  const [rtmToken, setRtmToken] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [rtmUid, setRtmUid] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);

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
          .select('channel_name, status')
          .eq('id', sessionId)
          .single();

        if (!isMounted) return;

        if (sessionError || !session) {
          console.error("[PracticeVideoRoom] Session fetch error:", sessionError);
          return;
        }

        console.log("[PracticeVideoRoom] Session found:", session);
        const fetchedChannelName = session.channel_name;
        setChannelName(fetchedChannelName);

        // Fetch Agora tokens
        console.log("[PracticeVideoRoom] Fetching Agora tokens for channel:", fetchedChannelName);

        const { data, error } = await supabase.functions.invoke('agora-token', {
          body: {
            channel: fetchedChannelName,
            role: "publisher",
            ttl: 3600,
          }
        });

        console.log("[PracticeVideoRoom] Token Response:", data);

        if (!isMounted) return;

        if (error || !data) {
          console.error("[PracticeVideoRoom] Token error:", error);
          return;
        }

        setRtcToken(data.rtcToken);
        setRtmToken(data.rtmToken);
        setUid(data.uid);
        setRtmUid(data.rtmUid);
      } catch (err) {
        console.error("[PracticeVideoRoom] Initialization failed:", err);
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
