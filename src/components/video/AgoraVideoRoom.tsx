import TelehealthRoomUnified from "./TelehealthRoomUnified";

interface AgoraVideoRoomProps {
  appId: string;
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
  tokenExpiresAt?: number | null;
}

export function AgoraVideoRoom({ 
  appId,
  channelName, 
  rtcToken, 
  uid, 
  userType,
  sessionId,
  patientId,
  tokenExpiresAt
}: ExtendedAgoraVideoRoomProps) {
  const isProvider = userType === "practice";

  return (
    <TelehealthRoomUnified
      appId={appId}
      channel={channelName}
      token={rtcToken}
      uid={uid}
      isProvider={isProvider}
      sessionId={sessionId}
      patientId={patientId}
      tokenExpiresAt={tokenExpiresAt}
    />
  );
}
