import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgoraCore } from "@/hooks/video/useAgoraCore";
import { useVideoEvents } from "@/hooks/video/useVideoEvents";
import { usePatientChart } from "@/hooks/video/usePatientChart";
import { useCallTimer } from "@/hooks/video/useCallTimer";
import { VideoRoomLayout } from "./core/VideoRoomLayout";
import { VideoGrid } from "./core/VideoGrid";
import { PatientIdentityPanel } from "./panels/PatientIdentityPanel";
import { WaitingRoomPanel } from "./panels/WaitingRoomPanel";
import { WaitingRoomStatus } from "./panels/WaitingRoomStatus";
import { PatientChartPanel } from "./panels/PatientChartPanel";
import { ControlBar } from "./controls/ControlBar";
import { MediaControls } from "./controls/MediaControls";
import { CommunicationControls } from "./controls/CommunicationControls";
import { ActionControls } from "./controls/ActionControls";

interface Props {
  appId: string;
  channel: string;
  token: string;
  uid: string | number;
  isProvider: boolean;
  sessionId: string;
  patientId: string;
  isGuest?: boolean;
  sessionType?: "instant" | "scheduled" | "practice_room";
}

export default function TelehealthRoomUnified({
  appId,
  channel,
  token,
  uid,
  isProvider,
  sessionId,
  patientId,
  isGuest = false,
  sessionType,
}: Props) {
  const navigate = useNavigate();

  // Core hooks
  const agora = useAgoraCore({ appId });
  const events = useVideoEvents({ sessionId, userUid: String(uid) });
  const chart = usePatientChart(patientId);
  const timer = useCallTimer();

  // UI state
  const [showChat, setShowChat] = useState(false);
  const [showChart, setShowChart] = useState(isProvider && !isGuest);
  const [isWaiting, setIsWaiting] = useState(!isProvider && !isGuest);

  // ============================================================================
  // JOIN & LEAVE LOGIC
  // ============================================================================
  useEffect(() => {
    const initSession = async () => {
      try {
        console.log("[TelehealthRoom] Joining session...", { appId, channel, uid });
        
        // Join Agora channel
        await agora.join(channel, token, String(uid));
        timer.start();

        // Guest: auto-join without publishing or waiting
        if (isGuest) {
          console.log("[TelehealthRoom] Guest joining - view-only mode");
          // Guests don't publish tracks or emit events
        } else if (isProvider) {
          // Provider: publish tracks immediately
          console.log("[TelehealthRoom] Provider joining - publishing tracks");
          await agora.publishTracks();
        } else {
          // Patient: emit waiting event after join
          console.log("[TelehealthRoom] Patient joining - emitting waiting event");
          await events.emitWaiting();
          setIsWaiting(true);
        }
      } catch (error) {
        console.error("[TelehealthRoom] Failed to join session:", error);
      }
    };

    initSession();

    return () => {
      console.log("[TelehealthRoom] Leaving session");
      agora.leave();
      timer.stop();
    };
  }, []);

  // ============================================================================
  // PATIENT ADMISSION FLOW
  // ============================================================================
  useEffect(() => {
    if (!isProvider && events.isAdmitted && isWaiting) {
      console.log("[TelehealthRoom] Patient admitted - publishing tracks");
      setIsWaiting(false);
      agora.publishTracks();
    }
  }, [events.isAdmitted, isProvider, isWaiting]);

  // ============================================================================
  // CONTROL HANDLERS
  // ============================================================================
  const handleEndCall = async () => {
    await agora.leave();
    timer.stop();
    
    const redirectPath = isProvider ? "/practice/calendar" : "/patient/dashboard";
    navigate(redirectPath);
  };

  const handleToggleChart = () => {
    setShowChart(!showChart);
  };

  const handleToggleChat = () => {
    setShowChat(!showChat);
  };

  const handleAdmitPatient = async (patientUid: string) => {
    console.log("[TelehealthRoom] Admitting patient:", patientUid);
    await events.emitAdmitted(patientUid);
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <VideoRoomLayout
      leftPanel={
        isGuest ? (
          <div className="p-4 flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <div className="inline-block px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium">
                Guest
              </div>
              <p className="text-sm text-muted-foreground">View-only access</p>
            </div>
          </div>
        ) : isProvider ? (
          <WaitingRoomPanel
            waitingPatients={events.waitingPatients}
            onAdmitPatient={handleAdmitPatient}
          />
        ) : (
          <PatientIdentityPanel
            patientId={patientId}
            patient={chart.chart?.patient}
            vitals={chart.chart?.vitals?.[0]}
          />
        )
      }
      centerContent={
        <>
          {/* Patient waiting overlay */}
          {!isProvider && isWaiting && (
            <div className="absolute inset-0 z-10">
              <WaitingRoomStatus estimatedWait={5} />
            </div>
          )}

          {/* Video grid */}
          <VideoGrid
            localVideoTrack={agora.localVideoTrack}
            remoteUsers={agora.remoteUsers}
            activeUserId={agora.remoteUsers[0]?.uid.toString()}
            isMicMuted={agora.localAudioTrack ? !agora.localAudioTrack.enabled : true}
            isCameraOff={agora.localVideoTrack ? !agora.localVideoTrack.enabled : true}
          />
        </>
      }
      rightPanel={
        isProvider && showChart && !isGuest ? (
          <PatientChartPanel
            patientId={patientId}
            chart={chart.chart}
            isCollapsed={false}
            onToggle={handleToggleChart}
          />
        ) : null
      }
      controlBar={
        isGuest ? (
          <ControlBar>
            <div className="flex items-center gap-2 px-4 text-sm text-muted-foreground">
              <span>Guest Mode - View Only</span>
              <span className="text-muted-foreground/50">•</span>
              <span>{timer.formattedDuration}</span>
            </div>
          </ControlBar>
        ) : (
          <ControlBar>
            <MediaControls
              isMicMuted={agora.localAudioTrack ? !agora.localAudioTrack.enabled : true}
              isCameraOff={agora.localVideoTrack ? !agora.localVideoTrack.enabled : true}
              onToggleMic={agora.toggleMic}
              onToggleCamera={agora.toggleCamera}
            />
            <CommunicationControls
              onOpenChat={handleToggleChat}
              onOpenParticipants={() => console.log("Open participants")}
            />
            <ActionControls
              onToggleChart={handleToggleChart}
              onEndCall={handleEndCall}
              callDuration={timer.formattedDuration}
            />
          </ControlBar>
        )
      }
      showLeftPanel={true}
      showRightPanel={isProvider && showChart}
    />
  );
}
