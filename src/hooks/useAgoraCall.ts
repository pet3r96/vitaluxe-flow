import { useCallback, useEffect, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, ILocalAudioTrack, ILocalVideoTrack } from "agora-rtc-sdk-ng";

interface UseAgoraCallParams {
  channel: string;
  userId: string;
  appId?: string;
  autoRenew?: boolean;
}

export function useAgoraCall({
  channel,
  userId,
  appId = import.meta.env.VITE_AGORA_APP_ID as string,
  autoRenew = true
}: UseAgoraCallParams) {
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micRef = useRef<ILocalAudioTrack | null>(null);
  const camRef = useRef<ILocalVideoTrack | null>(null);
  
  const [isJoined, setIsJoined] = useState(false);

  // Fetch token from backend
  const fetchToken = useCallback(async () => {
    try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agora-token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          uid: userId,
          role: 'publisher',
          ttl: 3600,
        }),
      }
    );

      // Defensive: capture text first so we can parse or show it
      const text = await response.text();

      if (!response.ok) {
        console.error(`❌ Token fetch failed (${response.status}):`, text);
        throw new Error(`Token fetch failed: ${response.status} - ${text}`);
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('❌ Token fetch: invalid JSON payload', text);
        throw new Error('Token fetch: invalid JSON payload');
      }

      if (!data.rtcToken) {
        console.error('❌ Missing rtcToken field:', data);
        throw new Error('Missing rtcToken field in token response');
      }

      return data.rtcToken;
    } catch (err: any) {
      console.error('❌ FetchToken error:', err);
      throw err;
    }
  }, [channel, userId]);

  // Join channel
  const join = useCallback(async () => {
    if (isJoined || clientRef.current) {
      console.warn('[useAgoraCall] Already joined');
      return;
    }

    try {
      console.log('[useAgoraCall] Fetching token...');
      const token = await fetchToken();

      console.log('[useAgoraCall] Creating RTC client...');
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      // Setup token renewal listeners
      if (autoRenew) {
        client.on('token-privilege-will-expire', async () => {
          console.log('[useAgoraCall] Token will expire, renewing...');
          try {
            const newToken = await fetchToken();
            await client.renewToken(newToken);
            console.log('[useAgoraCall] Token renewed successfully');
          } catch (error) {
            console.error('[useAgoraCall] Token renewal failed:', error);
          }
        });

        client.on('token-privilege-did-expire', async () => {
          console.error('[useAgoraCall] Token expired! Attempting immediate refresh...');
          try {
            const newToken = await fetchToken();
            await client.renewToken(newToken);
            console.log('[useAgoraCall] Emergency token refresh succeeded');
          } catch (error) {
            console.error('[useAgoraCall] Emergency token refresh failed, leaving call:', error);
            await leave();
          }
        });
      }

      // Setup remote user handlers
      client.on('user-published', async (user, mediaType) => {
        console.log('[useAgoraCall] Remote user published:', mediaType);
        await client.subscribe(user, mediaType);
        
        if (mediaType === 'video' && remoteVideoRef.current) {
          user.videoTrack?.play(remoteVideoRef.current);
        }
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      client.on('user-unpublished', (user) => {
        console.log('[useAgoraCall] Remote user unpublished');
      });

      // Join channel
      console.log('[useAgoraCall] Joining channel:', channel);
      await client.join(appId, channel, token, userId);
      console.log('[useAgoraCall] Joined successfully');

      // Create and publish local tracks
      console.log('[useAgoraCall] Creating local tracks...');
      const mic = await AgoraRTC.createMicrophoneAudioTrack();
      const cam = await AgoraRTC.createCameraVideoTrack();
      
      micRef.current = mic;
      camRef.current = cam;

      // Play local video
      if (localVideoRef.current) {
        cam.play(localVideoRef.current);
      }

      // Publish tracks
      console.log('[useAgoraCall] Publishing local tracks...');
      await client.publish([mic, cam]);

      setIsJoined(true);
      console.log('[useAgoraCall] Call setup complete');
    } catch (error) {
      console.error('[useAgoraCall] Join failed:', error);
      await leave();
      throw error;
    }
  }, [isJoined, channel, userId, appId, autoRenew, fetchToken]);

  // Leave channel
  const leave = useCallback(async () => {
    try {
      console.log('[useAgoraCall] Leaving call...');

      // Stop and close tracks
      if (camRef.current) {
        camRef.current.stop();
        camRef.current.close();
        camRef.current = null;
      }
      if (micRef.current) {
        micRef.current.stop();
        micRef.current.close();
        micRef.current = null;
      }

      // Leave channel
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }

      setIsJoined(false);
      console.log('[useAgoraCall] Left successfully');
    } catch (error) {
      console.error('[useAgoraCall] Leave error:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leave();
    };
  }, [leave]);

  return {
    localVideoRef,
    remoteVideoRef,
    join,
    leave,
    isJoined
  };
}
