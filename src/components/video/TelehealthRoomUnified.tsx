import { logger } from "@/lib/logger";
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
  tokenExpiresAt?: number | null;
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
  tokenExpiresAt: initialTokenExpiresAt,
}: Props) {
  const navigate = useNavigate();

  // 🔴 CRITICAL: Validate App ID before rendering
  if (!appId || appId.length !== 32) {
    console.error('🔴 [TelehealthRoomUnified] Invalid App ID detected:', {
      appId,
      appIdLength: appId?.length,
      expectedLength: 32
    });
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-lg font-semibold text-destructive">Invalid Configuration</div>
          <p className="text-sm text-muted-foreground">
            Unable to join video session due to invalid credentials.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // 🟡 DIAGNOSTIC: Received App ID
  console.log('🟡 [TelehealthRoomUnified] Received App ID:', {
    appId,
    appIdFull: JSON.stringify(appId),
    appIdType: typeof appId,
    appIdLength: appId?.length,
    timestamp: new Date().toISOString()
  });

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
        logger.info("[TelehealthRoom] Joining session...", { appId, channel, uid });
        
        // Join Agora channel
        await agora.join(channel, token, String(uid));
        timer.start();

        // Guest: auto-join without publishing or waiting
        if (isGuest) {
          logger.info("[TelehealthRoom] Guest joining - view-only mode");
          // Guests don't publish tracks or emit events
        } else if (isProvider) {
          // Provider: publish tracks immediately
          logger.info("[TelehealthRoom] Provider joining - publishing tracks");
          await agora.publishTracks();
        } else {
          // Patient: emit waiting event after join
          logger.info("[TelehealthRoom] Patient joining - emitting waiting event");
          await events.emitWaiting();
          setIsWaiting(true);
        }
      } catch (error) {
        logger.error("[TelehealthRoom] Failed to join session", error);
      }
    };

    initSession();

    return () => {
      logger.info("[TelehealthRoom] Leaving session");
      agora.leave();
      timer.stop();
    };
  }, []);

  // ============================================================================
  // TOKEN REFRESH LOGIC (prevents calls > 1hr from failing)
  // ============================================================================
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(initialTokenExpiresAt || null);

  useEffect(() => {
    if (!agora.isJoined || !tokenExpiresAt) return;
    
    const checkTokenExpiration = setInterval(async () => {
      const currentTime = Date.now() / 1000; // Convert to seconds
      const timeUntilExpiry = tokenExpiresAt - currentTime;
      
      // Refresh token if less than 5 minutes remaining
      if (timeUntilExpiry < 300 && timeUntilExpiry > 0) {
        logger.info('[TelehealthRoom] Token expiring soon, refreshing...', { 
          timeRemaining: timeUntilExpiry 
        });
        
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          
          // Call agora-token to get new token
          const { data, error } = await supabase.functions.invoke('agora-token', {
            body: {
              channel,
              role: isProvider ? 'publisher' : 'subscriber',
              ttl: 3600,
            },
          });
          
          if (error) throw error;
          
          // Renew token in Agora client
          await agora.renewToken(data.rtcToken);
          setTokenExpiresAt(data.expiresAt);
          
          logger.info('[TelehealthRoom] Token refreshed successfully', {
            newExpiresAt: data.expiresAt,
          });
        } catch (err) {
          logger.error('[TelehealthRoom] Failed to refresh token', err);
        }
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(checkTokenExpiration);
  }, [agora.isJoined, tokenExpiresAt, channel, isProvider]);

  // ============================================================================
  // PATIENT ADMISSION FLOW
  // ============================================================================
  useEffect(() => {
    if (!isProvider && events.isAdmitted && isWaiting) {
      logger.info("[TelehealthRoom] Patient admitted - publishing tracks");
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
    logger.info('Admitting patient', { patientUid });
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
              onOpenParticipants={() => logger.info('Open participants clicked')}
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
