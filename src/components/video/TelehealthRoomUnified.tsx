// ============================================================================
// TELEHEALTH ROOM UNIFIED
// Complete video room with waiting room, chart drawer, and realtime sync
// ============================================================================

import { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { supabase } from "@/integrations/supabase/client";
import { usePatientChartData } from "@/hooks/usePatientChartData";
import { emitEvent } from "@/lib/video/emitEvent";
import PatientChartDrawer from "@/components/patient/PatientChartDrawer";
import MiniPatientSummary from "@/components/patient/MiniPatientSummary";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  MessageCircle,
  Lock,
  LockOpen,
  Timer,
  ClipboardList,
  ScanEye,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ============================================================================
// TYPES
// ============================================================================

interface Props {
  appId: string;
  channel: string;
  token: string;
  uid: string | number;
  isProvider: boolean;
  sessionId: string;
  patientId: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TelehealthRoomUnified({
  appId,
  channel,
  token,
  uid,
  isProvider,
  sessionId,
  patientId,
}: Props) {
  // -------------------------------------------------------------------------
  // REFS
  // -------------------------------------------------------------------------
  const clientRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // -------------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------------
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [waitingRoom, setWaitingRoom] = useState(!isProvider);
  const [waitingPatients, setWaitingPatients] = useState<any[]>([]);
  const [patientAdmitted, setPatientAdmitted] = useState(false);
  const [roomLocked, setRoomLocked] = useState(false);
  const [sidePanel, setSidePanel] = useState<"chat" | "participants" | null>(null);
  const [duration, setDuration] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [backgroundBlur, setBackgroundBlur] = useState(false);

  // -------------------------------------------------------------------------
  // PATIENT CHART DATA
  // -------------------------------------------------------------------------
  const { chart, loading: chartLoading } = usePatientChartData(patientId);

  // -------------------------------------------------------------------------
  // REALTIME: SESSION EVENT SUBSCRIPTIONS
  // -------------------------------------------------------------------------
  useEffect(() => {
    console.log("🔄 [Realtime] Setting up subscription", {
      sessionId,
      uid,
      isProvider,
      channel: `video-${sessionId}`
    });

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
          console.log("📩 [Realtime] Event received:", payload);
          const { event_type, user_uid } = payload.new as any;

          // Provider: Listen for patients joining waiting room
          if (isProvider && event_type === "patient_waiting") {
            console.log("👤 [Provider] Patient joined waiting room:", user_uid);
            setWaitingPatients((prev) => {
              const exists = prev.find((p) => p.uid === user_uid);
              if (exists) {
                console.log("⚠️ [Provider] Patient already in list:", user_uid);
                return prev;
              }
              console.log("✅ [Provider] Adding patient to waiting list:", user_uid);
              return [...prev, { uid: user_uid }];
            });
          }

          // Patient: Listen for admission event
          if (!isProvider && event_type === "patient_admitted" && user_uid === String(uid)) {
            console.log("🎉 [Patient] Admitted by provider!");
            setPatientAdmitted(true);
            setWaitingRoom(false);
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 [Realtime] Subscription status:", status);
      });

    return () => {
      console.log("🔌 [Realtime] Cleaning up subscription");
      supabase.removeChannel(channelSub);
    };
  }, [sessionId, uid, isProvider]);

  // -------------------------------------------------------------------------
  // AGORA: JOIN ROOM (ONCE)
  // -------------------------------------------------------------------------
  const joinRoom = async () => {
    try {
      console.log("[Agora] Initializing client with appId:", appId?.substring(0, 8) + "...");
      
      if (!appId || appId === "undefined") {
        throw new Error("VITE_AGORA_APP_ID is not configured");
      }

      clientRef.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      const client = clientRef.current;

      // Handle remote users publishing
      client.on("user-published", async (user: any, mediaType: any) => {
        await client.subscribe(user, mediaType);

        if (mediaType === "video") {
          user.videoTrack.play(`remote-${user.uid}`);
        }
        if (mediaType === "audio") {
          user.audioTrack.play();
        }

        setRemoteUsers((prev) => {
          const exists = prev.find((u) => u.uid === user.uid);
          return exists ? prev : [...prev, user];
        });
      });

      // Handle remote users unpublishing
      client.on("user-unpublished", (user: any) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });

      // Network quality monitoring
      client.on("network-quality", (stats: any) => {
        // Quality indicator logic here
      });

      // Join channel
      console.log("[Agora] Joining channel:", channel, "with uid:", uid);
      await client.join(appId, channel, token, uid);
      console.log("[Agora] Successfully joined channel");

      // CRITICAL: Emit patient_waiting event AFTER successful join
      if (!isProvider) {
        console.log("[Patient] Broadcasting patient_waiting event");
        await emitEvent(sessionId, "patient_waiting", String(uid));
        setWaitingRoom(true); // Show waiting room overlay
      } else {
        // Provider publishes immediately
        await publishTracks();
      }

      // Start call timer
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (error: any) {
      console.error("[Agora] Join failed:", error);
      
      // Map Agora error codes to user-friendly messages
      let errorMessage = "Failed to join video session";
      if (error.code === 101) {
        errorMessage = "Invalid Agora App ID";
      } else if (error.code === 109) {
        errorMessage = "Token expired";
      } else if (error.code === 110) {
        errorMessage = "Invalid token";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.error("[Agora] Error details:", { code: error.code, message: errorMessage });
      // Don't auto-retry on critical errors
      if (error.code !== 101 && error.code !== 110) {
        setTimeout(joinRoom, 2000);
      }
    }
  };

  // -------------------------------------------------------------------------
  // PUBLISH TRACKS (Separate from joining)
  // -------------------------------------------------------------------------
  const publishTracks = async () => {
    try {
      const client = clientRef.current;
      if (!client) {
        console.error("[Agora] Client not initialized");
        return;
      }

      console.log("[Agora] Creating and publishing local tracks...");
      localAudioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
      localVideoTrackRef.current = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: { width: 1280, height: 720 },
      });

      localVideoTrackRef.current.play("local-preview");
      await client.publish([localAudioTrackRef.current, localVideoTrackRef.current]);
      console.log("[Agora] Tracks published successfully");
    } catch (error) {
      console.error("[Agora] Failed to publish tracks:", error);
    }
  };

  // -------------------------------------------------------------------------
  // MOUNT: Join room once
  // -------------------------------------------------------------------------
  useEffect(() => {
    joinRoom();
    return () => {
      clearInterval(timerRef.current);
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
      }
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
      }
      clientRef.current?.leave();
    };
  }, []); // Only run once on mount

  // -------------------------------------------------------------------------
  // PATIENT ADMISSION: Publish tracks when admitted
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isProvider && patientAdmitted && clientRef.current) {
      console.log("[Patient] Admitted! Publishing tracks...");
      setWaitingRoom(false);
      publishTracks();
    }
  }, [patientAdmitted, isProvider]);

  // -------------------------------------------------------------------------
  // CONTROLS
  // -------------------------------------------------------------------------
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
    window.location.href = isProvider ? "/practice/calendar" : "/patient/dashboard";
  };

  const admitPatient = async (patientUid: string) => {
    console.log("✅ [Provider] Admitting patient:", patientUid);
    try {
      await emitEvent(sessionId, "patient_admitted", patientUid);
      console.log("📤 [Provider] Admission event sent successfully");
      setWaitingPatients((prev) => prev.filter((p) => p.uid !== patientUid));
    } catch (error) {
      console.error("❌ [Provider] Failed to admit patient:", error);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <div className="relative flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* ===================================================================== */}
      {/* MINI PATIENT SUMMARY (Top Left)                                       */}
      {/* ===================================================================== */}
      <div className="absolute top-6 left-6 z-40">
        <MiniPatientSummary chart={chart} />
      </div>

      {/* ===================================================================== */}
      {/* WAITING ROOM PANEL (Provider - Top Right)                            */}
      {/* ===================================================================== */}
      {isProvider && (
        <Card className="absolute top-6 right-6 z-40 w-72 p-4 shadow-lg">
          <h3 className="font-semibold mb-3">Waiting Room</h3>
          {waitingPatients.length === 0 && (
            <p className="text-sm opacity-70">No patients waiting</p>
          )}
          <ScrollArea className="max-h-48">
            {waitingPatients.map((p) => (
              <div
                key={p.uid}
                className="flex items-center justify-between border rounded-md p-2 mb-2"
              >
                <span className="text-sm">Patient {p.uid}</span>
                <Button size="sm" onClick={() => admitPatient(p.uid)}>
                  Admit
                </Button>
              </div>
            ))}
          </ScrollArea>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* VIDEO GRID                                                            */}
      {/* ===================================================================== */}
      <div className="flex-1 relative p-6">
        {/* Remote Video Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
          {remoteUsers.map((user) => (
            <div
              key={user.uid}
              className="relative rounded-xl overflow-hidden bg-black border border-border"
            >
              <div id={`remote-${user.uid}`} className="w-full h-full" />
            </div>
          ))}

          {remoteUsers.length === 0 && (
            <div className="flex items-center justify-center col-span-full h-full">
              <p className="text-muted-foreground">Waiting for others to join...</p>
            </div>
          )}
        </div>

        {/* Local Preview (Bottom Right) */}
        <div
          id="local-preview"
          className="absolute bottom-6 right-6 w-48 h-32 rounded-xl border border-border shadow-lg overflow-hidden bg-black z-30"
        />

        {/* Waiting Room Overlay */}
        {waitingRoom && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
            <Card className="p-8 text-center">
              <p className="text-xl font-medium">
                {isProvider
                  ? "Patient is in the waiting room"
                  : "Waiting for provider to admit you..."}
              </p>
            </Card>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* SIDE PANEL (Chat / Participants)                                      */}
      {/* ===================================================================== */}
      {sidePanel && (
        <Card className="absolute right-0 top-0 bottom-0 w-80 z-30 border-l">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">
              {sidePanel === "chat" ? "Chat" : "Participants"}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setSidePanel(null)}>
              Close
            </Button>
          </div>
          <ScrollArea className="h-full p-4">
            {sidePanel === "chat" && <p className="text-sm">Chat coming soon...</p>}
            {sidePanel === "participants" && (
              <div className="space-y-2">
                <p className="text-sm">
                  {remoteUsers.length + 1} participant(s) in call
                </p>
              </div>
            )}
          </ScrollArea>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* BOTTOM CONTROL BAR                                                    */}
      {/* ===================================================================== */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center z-40">
        <Card className="flex items-center gap-3 px-6 py-3 shadow-lg">
          {/* Mic */}
          <Button onClick={toggleMic} variant="outline" size="icon" className="rounded-full">
            {mic ? <Mic /> : <MicOff className="text-destructive" />}
          </Button>

          {/* Camera */}
          <Button onClick={toggleCamera} variant="outline" size="icon" className="rounded-full">
            {camera ? <Video /> : <VideoOff className="text-destructive" />}
          </Button>

          <Separator orientation="vertical" className="h-8" />

          {/* Chat */}
          <Button
            onClick={() => setSidePanel(sidePanel === "chat" ? null : "chat")}
            variant="outline"
            size="icon"
            className="rounded-full"
          >
            <MessageCircle />
          </Button>

          {/* Participants */}
          <Button
            onClick={() => setSidePanel(sidePanel === "participants" ? null : "participants")}
            variant="outline"
            size="icon"
            className="rounded-full"
          >
            <Users />
          </Button>

          {/* Chart Drawer */}
          <Button
            onClick={() => setDrawerOpen(true)}
            variant="outline"
            size="icon"
            className="rounded-full"
          >
            <ClipboardList />
          </Button>

          <Separator orientation="vertical" className="h-8" />

          {/* Background Blur */}
          <Button
            onClick={() => setBackgroundBlur(!backgroundBlur)}
            variant="outline"
            size="icon"
            className="rounded-full"
          >
            <ScanEye />
          </Button>

          {/* Lock Room (Provider Only) */}
          {isProvider && (
            <Button
              onClick={() => setRoomLocked(!roomLocked)}
              variant="outline"
              size="icon"
              className="rounded-full"
            >
              {roomLocked ? <Lock /> : <LockOpen />}
            </Button>
          )}

          <Separator orientation="vertical" className="h-8" />

          {/* End Call */}
          <Button onClick={endCall} className="bg-destructive hover:bg-destructive/90 rounded-full">
            <PhoneOff />
          </Button>

          {/* Timer */}
          <div className="flex items-center gap-2 ml-4 text-sm text-muted-foreground">
            <Timer className="w-4 h-4" />
            {formatTime(duration)}
          </div>
        </Card>
      </div>

      {/* ===================================================================== */}
      {/* CHART DRAWER                                                          */}
      {/* ===================================================================== */}
      <PatientChartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        patientId={patientId}
      />
    </div>
  );
}
