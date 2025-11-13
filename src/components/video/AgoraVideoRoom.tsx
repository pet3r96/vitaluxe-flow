import AdvancedTelehealthRoom from "./AdvancedTelehealthRoom";

interface AgoraVideoRoomProps {
  channelName: string;
  rtcToken: string;
  rtmToken: string;
  uid: string;
  rtmUid: string;
  role: "publisher" | "subscriber";
  userType: "patient" | "practice" | "guest";
}

interface ExtendedAgoraVideoRoomProps extends AgoraVideoRoomProps {
  sessionId: string;
  patientId: string;
}

export function AgoraVideoRoom({ 
  channelName, 
  rtcToken, 
  uid, 
  userType,
  sessionId,
  patientId
}: ExtendedAgoraVideoRoomProps) {
  const appId = import.meta.env.VITE_AGORA_APP_ID;
  const isProvider = userType === "practice";

  return (
    <AdvancedTelehealthRoom
      appId={appId}
      channel={channelName}
      token={rtcToken}
      uid={uid}
      isProvider={isProvider}
      sessionId={sessionId}
      patientId={patientId}
    />
  );
}
