import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AgoraVideoRoom } from "@/components/video/AgoraVideoRoom";
import { supabase } from "@/integrations/supabase/client";
import { normalizeChannel } from "@/lib/video/normalizeChannel";
import { PreCallTestPrompt } from "@/components/video/PreCallTestPrompt";

const VideoGuestJoin = () => {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestData, setGuestData] = useState<any>(null);
  const [rtcToken, setRtcToken] = useState<string | null>(null);
  const [rtmToken, setRtmToken] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [rtmUid, setRtmUid] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initGuest = async () => {
      try {
        const { data, error } = await supabase
          .from("video_guest_links")
          .select("session_id, full_name")
          .eq("token", token)
          .single();

        if (!mounted) return;

        if (error || !data) {
          setError("Invalid or expired guest link.");
          return;
        }

        setGuestData(data);

        const { data: session, error: sessionErr } = await supabase
          .from("video_sessions")
          .select("channel_name")
          .eq("id", data.session_id)
          .single();

        if (!mounted) return;

        if (sessionErr || !session) {
          setError("Video session not found.");
          return;
        }

        const normalized = normalizeChannel(session.channel_name);

        const { data: tokens, error: tokenErr } = await supabase.functions.invoke("agora-token", {
          body: {
            channel: normalized,
            role: "audience",
            ttl: 3600,
          },
        });

        if (!mounted) return;

        if (tokenErr || !tokens) {
          setError("Failed to generate secure video credentials.");
          return;
        }

        setRtcToken(tokens.rtcToken);
        setRtmToken(tokens.rtmToken);
        setUid(tokens.uid);
        setRtmUid(tokens.rtmUid);
      } catch (e: any) {
        setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initGuest();

    return () => {
      mounted = false;
    };
  }, [token]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <div className="text-destructive text-lg font-semibold">Unable to Join Call</div>
        <p className="text-muted-foreground text-sm max-w-md text-center">{error}</p>
      </div>
    );
  }

  if (loading || !guestData || !rtcToken || !rtmToken || !uid || !rtmUid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading secure guest room…</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-screen">
      {/* Guest badge top-left */}
      <div className="absolute top-4 left-4 bg-primary text-white px-3 py-1 rounded shadow">
        Guest: {guestData.full_name}
      </div>

      {/* Pre-call test prompt top-center */}
      <PreCallTestPrompt sessionId={guestData.session_id} />

      {/* Video room */}
      <AgoraVideoRoom
        channelName={normalizeChannel(guestData.channel)}
        rtcToken={rtcToken}
        rtmToken={rtmToken}
        uid={uid}
        rtmUid={rtmUid}
        role="audience"
        userType="guest"
        sessionId={guestData.session_id}
      />
    </div>
  );
};

export default VideoGuestJoin;
