import { useCallback, useEffect, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, ILocalAudioTrack, ILocalVideoTrack } from "agora-rtc-sdk-ng";
import { logger } from "@/lib/logger";

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
  autoRenew = true,
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
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

      if (!SUPABASE_URL) {
        throw new Error("Missing VITE_SUPABASE_URL environment variable");
      }

      const TOKEN_ENDPOINT = `${SUPABASE_URL}/functions/v1/agora-token`;

      logger.info("Fetching Agora token", { channel, userId });

      const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel,
          uid: userId,
          role: "publisher",
          ttl: 3600,
        }),
      });

      const text = await response.text();

      if (!response.ok) {
        logger.error("Token fetch failed", null, { status: response.status });
        throw new Error(`Token fetch failed: ${response.status} - ${text}`);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        logger.error("Token fetch returned invalid JSON");
        throw new Error("Token fetch returned invalid JSON");
      }

      if (!data.rtcToken) {
        logger.error("Missing rtcToken in response");
        throw new Error("Missing rtcToken in response");
      }

      logger.info("Agora token fetched successfully");

      return data.rtcToken;
    } catch (err) {
      logger.error("fetchToken error", err);
      throw err;
    }
  }, [channel, userId]);

  // Join channel
  const join = useCallback(async () => {
    if (isJoined || clientRef.current) {
      logger.warn("Already joined Agora call");
      return;
    }

    try {
      logger.info("Fetching Agora token");
      const token = await fetchToken();

      logger.info("Creating Agora RTC client");
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      // Setup token renewal listeners
      if (autoRenew) {
        client.on("token-privilege-will-expire", async () => {
          logger.info("Agora token will expire, renewing");
          try {
            const newToken = await fetchToken();
            await client.renewToken(newToken);
            logger.info("Agora token renewed successfully");
          } catch (error) {
            logger.error("Agora token renewal failed", error);
          }
        });

        client.on("token-privilege-did-expire", async () => {
          logger.error("Agora token expired, attempting immediate refresh");
          try {
            const newToken = await fetchToken();
            await client.renewToken(newToken);
            logger.info("Emergency token refresh succeeded");
          } catch (error) {
            logger.error("Emergency token refresh failed", error);
            await leave();
          }
        });
      }

      // Setup remote user handlers
      client.on("user-published", async (user, mediaType) => {
        logger.info("Remote user published", { mediaType });
        await client.subscribe(user, mediaType);

        if (mediaType === "video" && remoteVideoRef.current) {
          user.videoTrack?.play(remoteVideoRef.current);
        }
        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
      });

      client.on("user-unpublished", (user) => {
        console.log("[useAgoraCall] Remote user unpublished");
      });

      // Join channel
      console.log("[useAgoraCall] Joining channel:", channel);

      console.log("[DEBUG] Agora JOIN PARAMETERS:", {
        appId,
        channel,
        token: token?.substring(0, 20) + "...",
        userId,
      });

      await client.join(appId, channel, token, userId);

      console.log("[useAgoraCall] Joined successfully");

      // Create and publish local tracks
      console.log("[useAgoraCall] Creating local tracks...");
      const mic = await AgoraRTC.createMicrophoneAudioTrack();
      const cam = await AgoraRTC.createCameraVideoTrack();

      micRef.current = mic;
      camRef.current = cam;

      // Play local video
      if (localVideoRef.current) {
        cam.play(localVideoRef.current);
      }

      // Publish tracks
      logger.info("Publishing local tracks");
      await client.publish([mic, cam]);

      setIsJoined(true);
      logger.info("Agora call setup complete");
    } catch (error) {
      logger.error("Agora join failed", error);
      await leave();
      throw error;
    }
  }, [isJoined, channel, userId, appId, autoRenew, fetchToken]);

  // Leave channel
  const leave = useCallback(async () => {
    try {
      logger.info("Leaving Agora call");

      // Stop and close tracks
      if (micRef.current) {
        micRef.current.stop();
        micRef.current.close();
        micRef.current = null;
      }

      if (camRef.current) {
        camRef.current.stop();
        camRef.current.close();
        camRef.current = null;
      }

      // Leave and destroy client
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }

      setIsJoined(false);
      logger.info("Left Agora call successfully");
    } catch (error) {
      logger.error("Agora leave error", error);
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
    isJoined,
  };
}
