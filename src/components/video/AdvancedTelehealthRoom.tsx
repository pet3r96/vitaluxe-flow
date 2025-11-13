// --- TELEHEALTH ROOM (FULL VIDEO + MINI-CHART + CHART DRAWER) ---
import { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

import { usePatientChartData } from "@/hooks/usePatientChartData";
import { MedicalChartDrawer } from "@/components/video/MedicalChartDrawer";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Signal,
  MessageCircle,
  Layers,
  Lock,
  LockOpen,
  Timer,
  ClipboardList,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// -------------------------------------------------------------
// PROPS
// -------------------------------------------------------------
interface Props {
  appId: string;
  channel: string;
  token: string;
  uid: string | number;
  isProvider: boolean;
  sessionId: string;
  patientId: string;
}

// -------------------------------------------------------------
// MAIN COMPONENT
// -------------------------------------------------------------
export default function TelehealthRoom({ appId, channel, token, uid, isProvider, sessionId, patientId }: Props) {
  // Agora refs
  const clientRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);

  // State
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState(5);
  const [waitingRoom, setWaitingRoom] = useState(!isProvider);
  const [waitingPatients, setWaitingPatients] = useState<any[]>([]);
  const [patientAdmitted, setPatientAdmitted] = useState(false);
  const [roomLocked, setRoomLocked] = useState(false);
  const [sidePanel, setSidePanel] = useState<"chat" | "participants" | null>(null);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<any>(null);

  // Chart drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Real-time patient chart data
  const chart = usePatientChartData(patientId);

  // -------------------------------------------------------------
  // REALTIME SESSION EVENT SUBSCRIPTIONS
  // -------------------------------------------------------------
  useEffect(() => {
    const channelSub = supabase
      .channel(`video-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "video_session_events",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const { event_type, user_uid } = payload.new as any;

          if (isProvider && event_type === "patient_waiting") {
            setWaitingPatients((prev) => (prev.find((p) => p.uid === user_uid) ? prev : [...prev, { uid: user_uid }]));
          }

          if (!isProvider && event_type === "patient_admitted" && user_uid === String(uid)) {
            setPatientAdmitted(true);
            setWaitingRoom(false);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSub);
    };
  }, [sessionId, uid, isProvider]);

  // -------------------------------------------------------------
  // AGORA JOIN
  // -------------------------------------------------------------
  const joinRoom = async () => {
    try {
      clientRef.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      const client = clientRef.current;

      client.on("user-published", async (user: any, mediaType: any) => {
        await client.subscribe(user, mediaType);

        if (mediaType === "video") user.videoTrack.play(`remote-${user.uid}`);
        if (mediaType === "audio") user.audioTrack.play();

        setRemoteUsers((prev) => [...prev, user]);
      });

      client.on("user-unpublished", (user: any) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });

      await client.join(appId, channel, token, uid);

      // Network quality
      client.on("network-quality", (stats: any) => {
        setConnectionQuality(Math.min(stats.uplinkNetworkQuality, stats.downlinkNetworkQuality));
      });

      // PATIENT: WAIT UNTIL ADMITTED
      if (!isProvider && !patientAdmitted) return;

      // PROVIDER / ADMITTED PATIENT → Publish streams
      localAudioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
      localVideoTrackRef.current = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: { width: 1280, height: 720 },
      });

      localVideoTrackRef.current.play("local-preview");
      await client.publish([localAudioTrackRef.current, localVideoTrackRef.current]);

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      setTimeout(joinRoom, 1500);
    }
  };

  useEffect(() => {
    joinRoom();
    return () => clearInterval(timerRef.current);
  }, [patientAdmitted]);

  // -------------------------------------------------------------
  // CONTROL BAR ACTIONS
  // -------------------------------------------------------------
  const toggleMic = () => {
    if (!localAudioTrackRef.current) return;
    localAudioTrackRef.current.setEnabled(!mic);
    setMic(!mic);
  };

  const toggleCamera = () => {
    if (!localVideoTrackRef.current) return;
    localVideoTrackRef.current.setEnabled(!camera);
    setCamera(!camera);
  };

  const endCall = async () => {
    await clientRef.current?.leave();
    window.location.href = "/practice/calendar";
  };

  const secondsToTime = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // -------------------------------------------------------------
  // UI
  // -------------------------------------------------------------
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden relative">
      {/* MINI PATIENT SUMMARY (LEFT SIDE) */}
      <div className="absolute top-6 left-6 bg-secondary/90 backdrop-blur-md border border-border rounded-xl p-4 shadow-lg w-64 z-40">
        <h2 className="font-semibold mb-2">Patient</h2>
        <p className="text-sm">{chart?.patient?.fullName}</p>
        <p className="text-xs opacity-70">{chart?.patient?.email}</p>

        <div className="mt-3 text-xs space-y-1">
          <div>
            <strong>DOB:</strong> {chart?.patient?.dob}
          </div>
          <div>
            <strong>Allergies:</strong> {chart?.allergies?.map((a) => a.name).join(", ") || "None"}
          </div>
          <div>
            <strong>Conditions:</strong> {chart?.conditions?.map((c) => c.name).join(", ") || "None"}
          </div>
        </div>

        <Button size="sm" className="mt-3 w-full" onClick={() => setDrawerOpen(true)}>
          Open Full Chart
        </Button>
      </div>

      {/* WAITING LIST (PROVIDER) */}
      {isProvider && (
        <div className="absolute top-6 right-6 bg-secondary/90 backdrop-blur-md border border-border rounded-xl p-4 w-64 shadow-lg z-40">
          <h2 className="font-semibold mb-2">Waiting Room</h2>
          {waitingPatients.length === 0 && <p className="text-sm opacity-70">No patients waiting…</p>}

          {waitingPatients.map((p) => (
            <div key={p.uid} className="flex justify-between items-center border px-2 py-1 rounded mt-2">
              <span>Patient {p.uid}</span>
              <Button
                size="sm"
                onClick={() =>
                  supabase.from("video_session_events").insert({
                    session_id: sessionId,
                    event_type: "patient_admitted",
                    user_uid: p.uid,
                  })
                }
              >
                Admit
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* VIDEO AREA */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 relative">
        {/* LOCAL PREVIEW */}
        <div
          id="local-preview"
          className="absolute bottom-6 right-6 w-40 h-28 rounded-xl border border-border shadow-lg overflow-hidden bg-black z-30"
        />

        {/* REMOTE STREAMS */}
        {remoteUsers.map((u) => (
          <div key={u.uid} className="rounded-xl overflow-hidden bg-black border border-border">
            <div id={`remote-${u.uid}`} className="w-full h-full" />
          </div>
        ))}

        {/* WAITING ROOM OVERLAY */}
        {waitingRoom && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-xl">
            {isProvider ? "Patient is in the waiting room" : "Waiting for provider to admit you…"}
          </div>
        )}
      </div>

      {/* BOTTOM CONTROL BAR */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center z-40">
        <div className="flex items-center gap-4 bg-secondary/80 backdrop-blur-md p-4 rounded-full border border-border shadow-lg">
          {/* MIC */}
          <Button onClick={toggleMic} variant="outline" size="icon" className="rounded-full h-14 w-14">
            {mic ? <Mic /> : <MicOff className="text-red-500" />}
          </Button>

          {/* CAMERA */}
          <Button onClick={toggleCamera} variant="outline" size="icon" className="rounded-full h-14 w-14">
            {camera ? <Video /> : <VideoOff className="text-red-500" />}
          </Button>

          {/* CHAT */}
          <Button
            onClick={() => setSidePanel(sidePanel === "chat" ? null : "chat")}
            variant="outline"
            size="icon"
            className="rounded-full h-14 w-14"
          >
            <MessageCircle />
          </Button>

          {/* PARTICIPANTS */}
          <Button
            onClick={() => setSidePanel(sidePanel === "participants" ? null : "participants")}
            variant="outline"
            size="icon"
            className="rounded-full h-14 w-14"
          >
            <Users />
          </Button>

          {/* LOCK */}
          {isProvider && (
            <Button
              onClick={() => setRoomLocked(!roomLocked)}
              variant="outline"
              size="icon"
              className="rounded-full h-14 w-14"
            >
              {roomLocked ? <Lock /> : <LockOpen />}
            </Button>
          )}

          {/* END CALL */}
          <Button onClick={endCall} className="bg-red-600 hover:bg-red-700 text-white h-14 w-14 rounded-full">
            <PhoneOff />
          </Button>
        </div>

        {/* TIMER */}
        <div className="absolute right-6 bottom-0 mb-2 flex items-center gap-2 text-sm opacity-70">
          <Timer className="w-4 h-4" />
          {secondsToTime(duration)}
        </div>
      </div>

      {/* CHART DRAWER */}
      <MedicalChartDrawer open={drawerOpen} onOpenChange={setDrawerOpen} chart={chart} patientId={patientId} />
    </div>
  );
}
