import { useEffect, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Camera, CameraOff, PhoneOff } from "lucide-react";

export function AgoraVideoRoom({ channelName, appId, token, uid }) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);

  const [remoteUsers, setRemoteUsers] = useState([]);

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const start = async () => {
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        setRemoteUsers(Array.from(client.remoteUsers));
      });

      client.on("user-unpublished", () => {
        setRemoteUsers(Array.from(client.remoteUsers));
      });

      const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      localAudioTrackRef.current = micTrack;
      localVideoTrackRef.current = camTrack;

      const localVideoContainer = document.getElementById("local-video");
      camTrack.play(localVideoContainer);

      await client.join(appId, channelName, token, uid);

      await client.publish([micTrack, camTrack]);

      setConnected(true);
    };

    start();

    return () => {
      if (clientRef.current) {
        clientRef.current.leave();
      }
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.close();
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 flex-1">
        <div id="local-video" className="w-full h-full bg-black rounded-md" />

        {remoteUsers.map((user) => (
          <div
            key={user.uid}
            id={`remote-${user.uid}`}
            className="w-full h-full bg-black rounded-md"
            ref={(el) => {
              if (el && user.videoTrack) {
                user.videoTrack.play(el);
              }
            }}
          />
        ))}
      </div>

      <div className="flex justify-center gap-4 mt-4">
        <Button
          onClick={() => {
            if (!localAudioTrackRef.current) return;
            micOn ? localAudioTrackRef.current.setEnabled(false) : localAudioTrackRef.current.setEnabled(true);
            setMicOn(!micOn);
          }}
        >
          {micOn ? <Mic /> : <MicOff />}
        </Button>

        <Button
          onClick={() => {
            if (!localVideoTrackRef.current) return;
            cameraOn ? localVideoTrackRef.current.setEnabled(false) : localVideoTrackRef.current.setEnabled(true);
            setCameraOn(!cameraOn);
          }}
        >
          {cameraOn ? <Camera /> : <CameraOff />}
        </Button>

        <Button
          variant="destructive"
          onClick={() => {
            clientRef.current?.leave();
            window.history.back();
          }}
        >
          <PhoneOff />
        </Button>
      </div>
    </div>
  );
}
