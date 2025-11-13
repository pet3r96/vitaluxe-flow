import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  ILocalAudioTrack,
  ILocalVideoTrack,
  IAgoraRTCRemoteUser,
  ConnectionState,
  NetworkQuality,
} from 'agora-rtc-sdk-ng';

export interface UseAgoraCoreParams {
  appId: string;
  onError?: (error: Error) => void;
}

export interface AgoraRemoteUser {
  uid: string;
  audioTrack?: any;
  videoTrack?: any;
  hasAudio: boolean;
  hasVideo: boolean;
}

export interface UseAgoraCoreReturn {
  client: IAgoraRTCClient | null;
  isJoined: boolean;
  localAudioTrack: ILocalAudioTrack | null;
  localVideoTrack: ILocalVideoTrack | null;
  remoteUsers: AgoraRemoteUser[];
  connectionState: ConnectionState;
  connectionQuality: NetworkQuality;
  
  join: (channel: string, token: string, uid: string | number) => Promise<void>;
  leave: () => Promise<void>;
  publishTracks: () => Promise<void>;
  unpublishTracks: () => Promise<void>;
  renewToken: (newToken: string) => Promise<void>;
  
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  switchCamera: (deviceId: string) => Promise<void>;
  switchMicrophone: (deviceId: string) => Promise<void>;
  
  isMicMuted: boolean;
  isCameraOff: boolean;
}

export const useAgoraCore = ({ appId, onError }: UseAgoraCoreParams): UseAgoraCoreReturn => {
  const [client] = useState<IAgoraRTCClient>(() => 
    AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
  );
  const [isJoined, setIsJoined] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ILocalVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<AgoraRemoteUser[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const [connectionQuality, setConnectionQuality] = useState<NetworkQuality>({
    uplinkNetworkQuality: 0,
    downlinkNetworkQuality: 0,
  });
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const cleanupRef = useRef<(() => void) | null>(null);

  // Handle remote user events
  useEffect(() => {
    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      await client.subscribe(user, mediaType);
      console.log('[useAgoraCore] User published:', user.uid, mediaType);
      
      setRemoteUsers(prev => {
        const existing = prev.find(u => u.uid === String(user.uid));
        if (existing) {
          return prev.map(u => 
            u.uid === String(user.uid)
              ? {
                  ...u,
                  [mediaType === 'audio' ? 'audioTrack' : 'videoTrack']: user[`${mediaType}Track`],
                  [mediaType === 'audio' ? 'hasAudio' : 'hasVideo']: true,
                }
              : u
          );
        }
        return [...prev, {
          uid: String(user.uid),
          audioTrack: mediaType === 'audio' ? user.audioTrack : undefined,
          videoTrack: mediaType === 'video' ? user.videoTrack : undefined,
          hasAudio: mediaType === 'audio',
          hasVideo: mediaType === 'video',
        }];
      });
    };

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      console.log('[useAgoraCore] User unpublished:', user.uid, mediaType);
      setRemoteUsers(prev => 
        prev.map(u => 
          u.uid === String(user.uid)
            ? {
                ...u,
                [mediaType === 'audio' ? 'audioTrack' : 'videoTrack']: undefined,
                [mediaType === 'audio' ? 'hasAudio' : 'hasVideo']: false,
              }
            : u
        )
      );
    };

    const handleUserJoined = (user: IAgoraRTCRemoteUser) => {
      console.log('[useAgoraCore] User joined:', user.uid);
      setRemoteUsers(prev => {
        if (prev.find(u => u.uid === String(user.uid))) return prev;
        return [...prev, {
          uid: String(user.uid),
          hasAudio: false,
          hasVideo: false,
        }];
      });
    };

    const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
      console.log('[useAgoraCore] User left:', user.uid);
      setRemoteUsers(prev => prev.filter(u => u.uid !== String(user.uid)));
    };

    const handleConnectionStateChange = (state: ConnectionState) => {
      console.log('[useAgoraCore] Connection state:', state);
      setConnectionState(state);
    };

    const handleNetworkQuality = (quality: NetworkQuality) => {
      setConnectionQuality(quality);
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-joined', handleUserJoined);
    client.on('user-left', handleUserLeft);
    client.on('connection-state-change', handleConnectionStateChange);
    client.on('network-quality', handleNetworkQuality);

    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      client.off('user-joined', handleUserJoined);
      client.off('user-left', handleUserLeft);
      client.off('connection-state-change', handleConnectionStateChange);
      client.off('network-quality', handleNetworkQuality);
    };
  }, [client]);

  const join = useCallback(async (channel: string, token: string, uid: string | number) => {
    try {
      console.log('[useAgoraCore] Joining channel:', channel, uid);
      
      if (!appId) {
        throw new Error('Agora App ID is required');
      }

      // Join the channel
      await client.join(appId, channel, token, uid);
      setIsJoined(true);
      
      // Create local tracks
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        { AEC: true, AGC: true, ANS: true },
        { encoderConfig: '720p_3' }
      );
      
      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);

      console.log('[useAgoraCore] Joined successfully');
    } catch (error) {
      console.error('[useAgoraCore] Join error:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [appId, client, onError]);

  const leave = useCallback(async () => {
    try {
      console.log('[useAgoraCore] Leaving channel');
      
      // Unpublish if published
      if (isJoined) {
        await unpublishTracks();
      }

      // Close local tracks
      localAudioTrack?.close();
      localVideoTrack?.close();
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);

      // Leave channel
      await client.leave();
      setIsJoined(false);
      setRemoteUsers([]);
      
      console.log('[useAgoraCore] Left successfully');
    } catch (error) {
      console.error('[useAgoraCore] Leave error:', error);
      onError?.(error as Error);
    }
  }, [client, isJoined, localAudioTrack, localVideoTrack, onError]);

  const publishTracks = useCallback(async () => {
    try {
      if (!localAudioTrack || !localVideoTrack) {
        throw new Error('Local tracks not created');
      }

      console.log('[useAgoraCore] Publishing tracks');
      await client.publish([localAudioTrack, localVideoTrack]);
      console.log('[useAgoraCore] Published successfully');
    } catch (error) {
      console.error('[useAgoraCore] Publish error:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [client, localAudioTrack, localVideoTrack, onError]);

  const unpublishTracks = useCallback(async () => {
    try {
      if (!localAudioTrack || !localVideoTrack) return;
      
      console.log('[useAgoraCore] Unpublishing tracks');
      await client.unpublish([localAudioTrack, localVideoTrack]);
      console.log('[useAgoraCore] Unpublished successfully');
    } catch (error) {
      console.error('[useAgoraCore] Unpublish error:', error);
      onError?.(error as Error);
    }
  }, [client, localAudioTrack, localVideoTrack, onError]);

  const renewToken = useCallback(async (newToken: string) => {
    try {
      console.log('[useAgoraCore] Renewing token');
      await client.renewToken(newToken);
      console.log('[useAgoraCore] Token renewed');
    } catch (error) {
      console.error('[useAgoraCore] Token renewal error:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [client, onError]);

  const toggleMic = useCallback(async () => {
    try {
      if (!localAudioTrack) return;
      
      const newMutedState = !isMicMuted;
      await localAudioTrack.setEnabled(!newMutedState);
      setIsMicMuted(newMutedState);
      console.log('[useAgoraCore] Mic toggled:', newMutedState ? 'muted' : 'unmuted');
    } catch (error) {
      console.error('[useAgoraCore] Toggle mic error:', error);
      onError?.(error as Error);
    }
  }, [localAudioTrack, isMicMuted, onError]);

  const toggleCamera = useCallback(async () => {
    try {
      if (!localVideoTrack) return;
      
      const newCameraState = !isCameraOff;
      await localVideoTrack.setEnabled(!newCameraState);
      setIsCameraOff(newCameraState);
      console.log('[useAgoraCore] Camera toggled:', newCameraState ? 'off' : 'on');
    } catch (error) {
      console.error('[useAgoraCore] Toggle camera error:', error);
      onError?.(error as Error);
    }
  }, [localVideoTrack, isCameraOff, onError]);

  const switchCamera = useCallback(async (deviceId: string) => {
    try {
      console.log('[useAgoraCore] Switching camera to:', deviceId);
      
      // Close old track
      if (localVideoTrack) {
        localVideoTrack.close();
      }
      
      // Create new track with specified device
      const newVideoTrack = await AgoraRTC.createCameraVideoTrack({
        cameraId: deviceId,
        encoderConfig: '720p_3',
      });
      
      setLocalVideoTrack(newVideoTrack);
      
      // If we're joined and published, replace the track
      if (isJoined && client.localTracks.includes(localVideoTrack!)) {
        await client.unpublish(localVideoTrack!);
        await client.publish(newVideoTrack);
      }
      
      console.log('[useAgoraCore] Camera switched');
    } catch (error) {
      console.error('[useAgoraCore] Switch camera error:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [localVideoTrack, client, isJoined, onError]);

  const switchMicrophone = useCallback(async (deviceId: string) => {
    try {
      console.log('[useAgoraCore] Switching microphone to:', deviceId);
      
      // Close old track
      if (localAudioTrack) {
        localAudioTrack.close();
      }
      
      // Create new track with specified device
      const newAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        microphoneId: deviceId,
        AEC: true,
        AGC: true,
        ANS: true,
      });
      
      setLocalAudioTrack(newAudioTrack);
      
      // If we're joined and published, replace the track
      if (isJoined && client.localTracks.includes(localAudioTrack!)) {
        await client.unpublish(localAudioTrack!);
        await client.publish(newAudioTrack);
      }
      
      console.log('[useAgoraCore] Microphone switched');
    } catch (error) {
      console.error('[useAgoraCore] Switch microphone error:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [localAudioTrack, client, isJoined, onError]);

  // Cleanup on unmount
  useEffect(() => {
    cleanupRef.current = () => {
      console.log('[useAgoraCore] Cleanup on unmount');
      leave();
    };

    return () => {
      cleanupRef.current?.();
    };
  }, [leave]);

  return {
    client,
    isJoined,
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
    connectionState,
    connectionQuality,
    join,
    leave,
    publishTracks,
    unpublishTracks,
    renewToken,
    toggleMic,
    toggleCamera,
    switchCamera,
    switchMicrophone,
    isMicMuted,
    isCameraOff,
  };
};
