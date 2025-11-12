import { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm-sdk";

export const AgoraVideoRoom = ({
  channelName,
  rtcToken,
  rtmToken,
  uid,
  rtmUid,
  role = "subscriber",
  userType = "patient"
}) => {
  const rtcClientRef = useRef<any>(null);
  const rtmClientRef = useRef<any>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      try {
        console.log("[AgoraRoom] Initializing…", {
          channelName,
          uid,
          rtmUid,
          role
        });

        // 1. Initialize RTC
        rtcClientRef.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

        await rtcClientRef.current.join(
          import.meta.env.VITE_AGORA_APP_ID,
          channelName,
          rtcToken,
          uid
        );

        if (!mounted) return;

        // 2. Initialize RTM
        rtmClientRef.current = AgoraRTM.createInstance(import.meta.env.VITE_AGORA_APP_ID);
        await rtmClientRef.current.login({ uid: rtmUid, token: rtmToken });

        if (!mounted) return;

        setJoined(true);
        console.log("[AgoraRoom] RTC + RTM JOINED SUCCESSFULLY");
      } catch (err) {
        console.error("[AgoraRoom] JOIN ERROR:", err);
      }
    };

    start();

    return () => {
      mounted = false;
      try {
        rtcClientRef.current?.leave();
      } catch {}
      try {
        rtmClientRef.current?.logout();
      } catch {}
    };
  }, [channelName, rtcToken, rtmToken, uid, rtmUid]);

  if (!joined) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Connecting to secure video…</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black text-white flex items-center justify-center">
      <div>Video Call Connected ✔️</div>
    </div>
  );
};
