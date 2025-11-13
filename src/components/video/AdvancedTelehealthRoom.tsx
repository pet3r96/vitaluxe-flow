import { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { emitEvent } from "@/lib/video/emitEvent";
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
  Lock,
  LockOpen,
  Timer,
  CircleDot,
  ClipboardList,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  appId: string;
  channel: string;
  token: string;
  uid: string | number;
  isProvider: boolean;
  sessionId: string;
}

export default function AdvancedTelehealthRoom({ appId, channel, token, uid, isProvider, sessionId }: Props) {
  // ---------------------------------------------------------
  // STATE
  // ---------------------------------------------------------

  // Agora engine
  const clientRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);

  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);

  // Toggles
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);

  // Sidebar: chat | participants | providerDash
  const [sidePanel, setSidePanel] = useState<"chat" | "participants" | "providerDash" | null>(null);

  // Chat
  const [chat, setChat] = useState<{ from: string; message: string }[]>([]);
  const [chatInput, setChatInput] = useState("");

  // Waiting room & provider dashboard
  const [waitingRoom, setWaitingRoom] = useState(!isProvider);
  const [waitingPatients, setWaitingPatients] = useState<any[]>([]);
  const [patientAdmitted, setPatientAdmitted] = useState(false);
  const [roomLocked, setRoomLocked] = useState(false);

  // Timer + recording
  const [duration, setDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState(5);

  // Effects
  const [blur, setBlur] = useState(false);

  // Provider Dashboard notes/vitals
  const [providerNotes, setProviderNotes] = useState("");
  const [vitals, setVitals] = useState({
    height: "",
    weight: "",
    bloodPressure: "",
    meds: "",
  });

  const timerRef = useRef<any>(null);

  // ---------------------------------------------------------
  // REALTIME SUBSCRIPTIONS
  // ---------------------------------------------------------
  useEffect(() => {
    console.log(`[Realtime] Subscribing to session: ${sessionId}`);
    
    const channelEvents = supabase
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
          console.log("[Realtime] Event received:", payload);
          const { event_type, user_uid } = payload.new as any;

          if (isProvider && event_type === "patient_waiting") {
            console.log(`[Provider] Patient ${user_uid} is waiting`);
            setWaitingPatients((prev) => {
              // Prevent duplicates
              if (prev.find((p) => p.uid === user_uid)) return prev;
              return [...prev, { uid: user_uid }];
            });
          }

          if (!isProvider && event_type === "patient_admitted" && user_uid === String(uid)) {
            console.log(`[Patient] Admitted by provider`);
            setPatientAdmitted(true);
            setWaitingRoom(false);
          }
        }
      )
      .subscribe();

    return () => {
      console.log("[Realtime] Unsubscribing");
      supabase.removeChannel(channelEvents);
    };
  }, [sessionId, isProvider, uid]);

  // ---------------------------------------------------------
  // PATIENT BROADCAST ON JOIN
  // ---------------------------------------------------------
  useEffect(() => {
    if (!isProvider) {
      console.log(`[Patient] Broadcasting waiting status: ${uid}`);
      emitEvent(sessionId, "patient_waiting", String(uid));
    }
  }, [isProvider, sessionId, uid]);

  // ---------------------------------------------------------
  // ADMIT FUNCTION (Provider only)
  // ---------------------------------------------------------
  const admitPatient = async (patientUid: string) => {
    console.log(`[Provider] Admitting patient: ${patientUid}`);
    await emitEvent(sessionId, "patient_admitted", patientUid);

    // Remove from queue
    setWaitingPatients((prev) => prev.filter((p) => p.uid !== patientUid));
  };

  // ---------------------------------------------------------
  // JOIN ROOM
  // ---------------------------------------------------------

  const joinRoom = async () => {
    try {
      clientRef.current = AgoraRTC.createClient({
        mode: "rtc",
        codec: "vp8",
      });

      const client = clientRef.current;

      client.on("user-published", async (user: any, mediaType: any) => {
        await client.subscribe(user, mediaType);

        if (mediaType === "video") {
          user.videoTrack.play(`remote-${user.uid}`);
        }
        if (mediaType === "audio") {
          user.audioTrack.play();
        }

        setRemoteUsers((prev) => [...prev, user]);
      });

      client.on("user-unpublished", (user: any) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });

      // Join Agora channel
      await client.join(appId, channel, token, uid);

      // Network quality listener
      client.on("network-quality", (stats: any) => {
        const quality = Math.min(stats.uplinkNetworkQuality, stats.downlinkNetworkQuality);
        setConnectionQuality(quality);
      });

      // PATIENT WAITING — DO NOT PUBLISH TRACKS
      if (!isProvider && !patientAdmitted) {
        console.log("[Patient] Waiting for admission, not publishing tracks");
        return;
      }

      // PROVIDER OR ADMITTED PATIENT — publish tracks
      console.log("[Join] Publishing audio/video tracks");
      localAudioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
      localVideoTrackRef.current = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: { width: 1280, height: 720 },
      });

      localVideoTrackRef.current.play("local-preview");

      await client.publish([localAudioTrackRef.current, localVideoTrackRef.current]);

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      console.error("[Retry Join] Failed, retrying...", err);
      setTimeout(joinRoom, 1500);
    }
  };

  useEffect(() => {
    joinRoom();
    return () => clearInterval(timerRef.current);
  }, [patientAdmitted]);

  // ---------------------------------------------------------
  // CONTROLS
  // ---------------------------------------------------------

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

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <div className={cn("flex h-screen w-full bg-background text-foreground overflow-hidden")}>
      {/* PROVIDER WAITING LIST SIDEBAR */}
      {isProvider && (
        <div className="absolute left-4 top-20 z-40 bg-secondary/90 backdrop-blur-md border border-border rounded-lg p-4 w-72 shadow-lg">
          <h2 className="text-lg font-semibold mb-3">Waiting Patients</h2>

          {waitingPatients.length === 0 && <p className="text-sm opacity-70">No patients waiting...</p>}

          <ScrollArea className="max-h-96">
            {waitingPatients.map((p) => (
              <div key={p.uid} className="flex justify-between items-center p-2 border rounded mb-2 bg-background">
                <span className="text-sm">Patient {p.uid}</span>
                <Button size="sm" onClick={() => admitPatient(p.uid)}>
                  Admit
                </Button>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}

      {/* MAIN VIDEO GRID */}
      <div className="flex-1 relative grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
        {/* PiP */}
        <div
          id="local-preview"
          className={cn(
            "absolute bottom-6 right-6 w-48 h-32 rounded-xl overflow-hidden shadow-lg bg-black border border-border z-40"
          )}
        />

        {/* Remote Streams */}
        {remoteUsers.map((user) => (
          <div key={user.uid} className="relative rounded-xl bg-black h-full border border-border overflow-hidden">
            <div id={`remote-${user.uid}`} className="w-full h-full" />
          </div>
        ))}

        {waitingRoom && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-xl font-semibold z-50">
            {isProvider ? "Patient in waiting room" : "Waiting for provider to admit you..."}
          </div>
        )}
      </div>

      {/* SIDEBAR */}
      {sidePanel && (
        <div className="w-80 h-full border-l border-border flex flex-col bg-secondary z-30">
          <div className="p-4 font-semibold border-b border-border">
            {sidePanel === "chat" && "Chat"}
            {sidePanel === "participants" && "Participants"}
            {sidePanel === "providerDash" && "Provider Dashboard"}
          </div>

          <ScrollArea className="flex-1 p-4">
            {sidePanel === "chat" &&
              chat.map((c, i) => (
                <div key={i} className="mb-3">
                  <div className="text-sm font-medium">{c.from}</div>
                  <div className="text-sm opacity-80">{c.message}</div>
                </div>
              ))}

            {sidePanel === "participants" &&
              remoteUsers.map((user) => (
                <div key={user.uid} className="mb-3 flex items-center gap-3">
                  <Users className="w-4 h-4" />
                  <span>User {user.uid}</span>
                </div>
              ))}

            {sidePanel === "providerDash" && isProvider && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Vitals</h3>

                <Input
                  placeholder="Height"
                  value={vitals.height}
                  onChange={(e) => setVitals((v) => ({ ...v, height: e.target.value }))}
                />
                <Input
                  placeholder="Weight"
                  value={vitals.weight}
                  onChange={(e) => setVitals((v) => ({ ...v, weight: e.target.value }))}
                />
                <Input
                  placeholder="Blood Pressure"
                  value={vitals.bloodPressure}
                  onChange={(e) =>
                    setVitals((v) => ({
                      ...v,
                      bloodPressure: e.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="Medications"
                  value={vitals.meds}
                  onChange={(e) => setVitals((v) => ({ ...v, meds: e.target.value }))}
                />

                <h3 className="text-sm font-semibold pt-4">Provider Notes</h3>
                <Textarea
                  placeholder="Notes..."
                  value={providerNotes}
                  onChange={(e) => setProviderNotes(e.target.value)}
                />
              </div>
            )}
          </ScrollArea>

          {/* Chat input */}
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

          {isProvider && (
            <Button
              onClick={() => setSidePanel(sidePanel === "providerDash" ? null : "providerDash")}
              variant="outline"
              size="icon"
              className="rounded-full h-14 w-14"
            >
              <ClipboardList />
            </Button>
          )}

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

      {/* LOCK ROOM */}
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
