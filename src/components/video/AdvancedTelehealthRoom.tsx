import { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { cn } from "@/lib/utils";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Signal,
  Layers,
  MessageCircle,
  MonitorUp,
  Lock,
  LockOpen,
  Timer,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

interface Props {
  appId: string;
  channel: string;
  token: string;
  uid: string | number;
  isProvider: boolean;
}

export default function AdvancedTelehealthRoom({ appId, channel, token, uid, isProvider }: Props) {
  const clientRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);

  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [sidePanel, setSidePanel] = useState<"chat" | "participants" | null>(null);
  const [chat, setChat] = useState<{ from: string; message: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [waitingRoom, setWaitingRoom] = useState(true);
  const [roomLocked, setRoomLocked] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState(5);
  const [blur, setBlur] = useState(false);
  const timerRef = useRef<any>(null);

  // Auto-retry
  const joinRoom = async () => {
    try {
      clientRef.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      const client = clientRef.current;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "video") {
          const remoteVideoTrack = user.videoTrack;
          remoteVideoTrack.play(`remote-${user.uid}`);
        }
        if (mediaType === "audio") {
          user.audioTrack.play();
        }
        setRemoteUsers((prev) => [...prev, user]);
      });

      client.on("user-unpublished", (user) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });

      await client.join(appId, channel, token, uid);

      client.on("network-quality", (stats) => {
        // stats.uplinkNetworkQuality and stats.downlinkNetworkQuality are 0–5
        // Pick the worse of the two
        const quality = Math.min(stats.uplinkNetworkQuality, stats.downlinkNetworkQuality);

        console.log("[Connection Quality]", {
          uplink: stats.uplinkNetworkQuality,
          downlink: stats.downlinkNetworkQuality,
          selected: quality,
        });

        setConnectionQuality(quality);
      });

      // Waiting room logic
      if (!isProvider) {
        await new Promise((r) => setTimeout(r, 800));
        if (roomLocked) return;
      }
      setWaitingRoom(false);

      localAudioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
      localVideoTrackRef.current = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: { width: 1280, height: 720 },
      });

      localVideoTrackRef.current.play("local-preview");
      await client.publish([localAudioTrackRef.current, localVideoTrackRef.current]);

      // Start call duration timer
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      console.error("[Retry Join] Failed, retrying...", err);
      setTimeout(joinRoom, 1500);
    }
  };

  useEffect(() => {
    joinRoom();
    return () => clearInterval(timerRef.current);
  }, []);

  const toggleMic = () => {
    if (!localAudioTrackRef.current) return;
    if (mic) localAudioTrackRef.current.setEnabled(false);
    else localAudioTrackRef.current.setEnabled(true);
    setMic(!mic);
  };

  const toggleCamera = () => {
    if (!localVideoTrackRef.current) return;
    if (camera) localVideoTrackRef.current.setEnabled(false);
    else localVideoTrackRef.current.setEnabled(true);
    setCamera(!camera);
  };

  const toggleBlur = async () => {
    if (!localVideoTrackRef.current) return;
    if (!blur) {
      localVideoTrackRef.current.setProcessor({
        type: "background",
        mode: "blur",
        blurDegree: 5,
      });
    } else {
      localVideoTrackRef.current.setProcessor(null);
    }
    setBlur(!blur);
  };

  const endCall = async () => {
    try {
      await clientRef.current.leave();
      window.location.href = "/practice/calendar";
    } catch {}
  };

  const secondsToTime = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className={cn("flex h-screen w-full bg-background text-foreground overflow-hidden")}>
      {/* MAIN VIDEO GRID */}
      <div className="flex-1 relative grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
        {/* Local Floating PiP */}
        <div
          id="local-preview"
          className={cn(
            "absolute bottom-6 right-6 w-48 h-32 rounded-xl overflow-hidden shadow-lg bg-black cursor-move border",
            "border-border z-40",
          )}
        />

        {/* Remote Videos */}
        {remoteUsers.map((user) => (
          <div key={user.uid} className="relative rounded-xl bg-black h-full border border-border overflow-hidden">
            <div id={`remote-${user.uid}`} className="w-full h-full" />
          </div>
        ))}

        {waitingRoom && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-xl font-semibold z-50">
            Waiting for provider to start the video session...
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR (Chat / Participants) */}
      {sidePanel && (
        <div className="w-80 h-full border-l border-border flex flex-col bg-secondary z-30">
          {/* Header */}
          <div className="p-4 font-semibold border-b border-border">
            {sidePanel === "chat" ? "Chat" : "Participants"}
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 p-4">
            {sidePanel === "chat"
              ? chat.map((c, i) => (
                  <div key={i} className="mb-3">
                    <div className="text-sm font-medium">{c.from}</div>
                    <div className="text-sm opacity-80">{c.message}</div>
                  </div>
                ))
              : remoteUsers.map((user) => (
                  <div key={user.uid} className="mb-3 flex items-center gap-3">
                    <Users className="w-4 h-4" />
                    <span>User {user.uid}</span>
                  </div>
                ))}
          </ScrollArea>

          {/* Chat Input */}
          {sidePanel === "chat" && (
            <div className="p-4 border-t border-border">
              <Input placeholder="Type message…" value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {/* CONTROL BAR */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center z-50">
        <div className="flex items-center gap-4 bg-secondary/80 backdrop-blur-md p-4 rounded-full border border-border shadow-lg">
          <Button onClick={toggleMic} variant="outline" size="icon" className="rounded-full h-14 w-14">
            {mic ? <Mic /> : <MicOff className="text-red-500" />}
          </Button>

          <Button onClick={toggleCamera} variant="outline" size="icon" className="rounded-full h-14 w-14">
            {camera ? <Video /> : <VideoOff className="text-red-500" />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={async () => {
              try {
                const testCam = await AgoraRTC.createCameraVideoTrack();
                const testMic = await AgoraRTC.createMicrophoneAudioTrack();

                testCam.play("local-preview");
                testMic.play();

                console.log("[Video Test] Camera + mic OK");

                setTimeout(() => testCam.stop(), 3000); // auto stop after 3s
              } catch (err) {
                console.error("[Video Test] Error initializing devices", err);
              }
            }}
            className="rounded-full h-14 w-14"
          >
            <Signal />
          </Button>

          <Button
            onClick={() => setSidePanel(sidePanel === "chat" ? null : "chat")}
            variant="outline"
            size="icon"
            className="rounded-full h-14 w-14"
          >
            <MessageCircle />
          </Button>

          <Button
            onClick={() => setSidePanel(sidePanel === "participants" ? null : "participants")}
            variant="outline"
            size="icon"
            className="rounded-full h-14 w-14"
          >
            <Users />
          </Button>

          <Button onClick={toggleBlur} variant="outline" size="icon" className="rounded-full h-14 w-14">
            <Layers />
          </Button>

          <Button
            onClick={() => setRecording(!recording)}
            variant="outline"
            size="icon"
            className="rounded-full h-14 w-14"
          >
            <CircleDot className={recording ? "text-red-500 animate-pulse" : ""} />
          </Button>

          <Button
            onClick={endCall}
            size="icon"
            className="bg-red-600 hover:bg-red-700 text-white h-14 w-14 rounded-full"
          >
            <PhoneOff />
          </Button>
        </div>

        {/* Timer */}
        <div className="absolute right-6 bottom-0 mb-2 flex items-center gap-2 text-sm opacity-80">
          <Timer className="w-4 h-4" />
          {secondsToTime(duration)}
        </div>
      </div>

      {/* CONNECTION QUALITY */}
      <div className="absolute top-6 right-6 flex items-center gap-2 text-sm">
        <Signal
          className={
            connectionQuality < 2 ? "text-red-500" : connectionQuality < 4 ? "text-yellow-500" : "text-green-500"
          }
        />
        {["Poor", "Low", "Fair", "Good", "Great", "Excellent"][connectionQuality]}
      </div>

      {/* LOCK ROOM (provider only) */}
      {isProvider && (
        <div className="absolute top-6 left-6">
          <Button onClick={() => setRoomLocked(!roomLocked)} variant="outline" size="sm">
            {roomLocked ? <Lock className="mr-2" /> : <LockOpen className="mr-2" />}
            {roomLocked ? "Room Locked" : "Lock Room"}
          </Button>
        </div>
      )}
    </div>
  );
}
