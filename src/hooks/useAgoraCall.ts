import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, ILocalAudioTrack, ILocalVideoTrack } from "agora-rtc-sdk-ng";
import type { IAgoraRTCRemoteUser } from "agora-rtc-sdk-ng";

type StartParams = {
  channel: string;
  uid?: string | number;         // default: random
  role?: "publisher" | "subscriber";
  ttlSeconds?: number;           // default: 3600
  containerLocal?: HTMLElement | null;   // optional mount
  containerRemote?: HTMLElement | null;  // optional mount
};

type UseAgoraCallOpts = {
  tokenEndpoint?: string; // default: /functions/v1/agora-token
};

type TokenResponse = {
  ok: boolean;
  appId: string;
  rtcToken: string;
  channel: string;
  uid: string;
  role: string;
  expiresAt: number; // unix sec
};

export function useAgoraCall(opts: UseAgoraCallOpts = {}) {
  const tokenEndpoint = opts.tokenEndpoint || "/functions/v1/agora-token";
  const appId = import.meta.env.VITE_AGORA_APP_ID as string;

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micRef = useRef<ILocalAudioTrack | null>(null);
  const camRef = useRef<ILocalVideoTrack | null>(null);
  const tokenRef = useRef<string>("");
  const expiresRef = useRef<number>(0);
  const channelRef = useRef<string>("");
  const uidRef = useRef<string | number>("");

  const [joined, setJoined] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshInSec, setRefreshInSec] = useState<number | null>(null);

  const getToken = useCallback(async (channel: string, uid: string | number, role: "publisher"|"subscriber", ttlSeconds = 3600): Promise<TokenResponse> => {
    const res = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ channel, uid, role, ttl: ttlSeconds })
    });
    if (!res.ok) throw new Error(`Token endpoint ${res.status}`);
    const data = await res.json() as TokenResponse;
    if (!data.ok || !data.rtcToken) throw new Error("Bad token payload");
    return data;
  }, [tokenEndpoint]);

  const scheduleAutoRefresh = useCallback(() => {
    if (!expiresRef.current) { setRefreshInSec(null); return; }
    // refresh 5 minutes before expiry
    const now = Math.floor(Date.now()/1000);
    const delta = Math.max(0, expiresRef.current - now - 5*60);
    setRefreshInSec(delta);
    if (delta <= 0) {
      clientRef.current?.renewToken?.(tokenRef.current).catch(()=>{});
      return;
    }
    const t = setTimeout(async () => {
      try {
        // Emergency refresh (same channel/uid/role)
        const data = await getToken(channelRef.current, uidRef.current, "publisher", 3600);
        tokenRef.current = data.rtcToken;
        expiresRef.current = data.expiresAt;
        await clientRef.current?.renewToken(data.rtcToken);
        scheduleAutoRefresh();
      } catch (e:any) {
        console.error("Auto refresh failed:", e?.message || e);
      }
    }, delta*1000);
    return () => clearTimeout(t);
  }, [getToken]);

  const start = useCallback(async (p: StartParams) => {
    setError(null);
    const channel = p.channel;
    const uid = p.uid ?? Math.floor(1e9 * Math.random());
    const role = p.role ?? "publisher";
    const ttl = p.ttlSeconds ?? 3600;

    const data = await getToken(channel, uid, role, ttl);

    channelRef.current = channel;
    uidRef.current = uid;
    tokenRef.current = data.rtcToken;
    expiresRef.current = data.expiresAt;

    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    clientRef.current = client;

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "video" && p.containerRemote) {
        user.videoTrack?.play(p.containerRemote);
      }
      if (mediaType === "audio") {
        user.audioTrack?.play();
      }
      setRemoteUsers(Array.from(client.remoteUsers || []));
    });

    client.on("user-unpublished", () => {
      setRemoteUsers(Array.from(client.remoteUsers || []));
    });

    client.on("token-privilege-will-expire", async () => {
      try {
        const latest = await getToken(channelRef.current, uidRef.current, "publisher", 3600);
        tokenRef.current = latest.rtcToken;
        expiresRef.current = latest.expiresAt;
        await client.renewToken(latest.rtcToken);
        scheduleAutoRefresh();
      } catch (e:any) {
        console.error("will-expire refresh failed:", e?.message || e);
      }
    });

    client.on("token-privilege-did-expire", async () => {
      try {
        const latest = await getToken(channelRef.current, uidRef.current, "publisher", 3600);
        tokenRef.current = latest.rtcToken;
        expiresRef.current = latest.expiresAt;
        await client.renewToken(latest.rtcToken);
        scheduleAutoRefresh();
      } catch (e:any) {
        setError("Token expired and refresh failed.");
      }
    });

    await client.join(data.appId, channel, data.rtcToken, uid);

    // local tracks for 1:1
    const mic = await AgoraRTC.createMicrophoneAudioTrack();
    const cam = await AgoraRTC.createCameraVideoTrack();
    micRef.current = mic;
    camRef.current = cam;

    if (p.containerLocal) {
      cam.play(p.containerLocal);
    }

    await client.publish([mic, cam]);

    setJoined(true);
    const cleanup = scheduleAutoRefresh();
    return () => cleanup?.();
  }, [getToken, scheduleAutoRefresh]);

  const leave = useCallback(async () => {
    try {
      camRef.current?.stop(); camRef.current?.close();
      micRef.current?.stop(); micRef.current?.close();
      camRef.current = null; micRef.current = null;

      if (clientRef.current) {
        await clientRef.current.unpublish();
        await clientRef.current.leave();
        clientRef.current = null;
      }
    } finally {
      setJoined(false);
      setRemoteUsers([]);
      tokenRef.current = "";
      expiresRef.current = 0;
      channelRef.current = "";
      uidRef.current = "";
    }
  }, []);

  const publishCamera = useCallback(async () => {
    if (!clientRef.current) return;
    if (!camRef.current) {
      camRef.current = await AgoraRTC.createCameraVideoTrack();
    }
    await clientRef.current.publish(camRef.current);
  }, []);

  const unpublishCamera = useCallback(async () => {
    if (clientRef.current && camRef.current) {
      await clientRef.current.unpublish(camRef.current);
      camRef.current.stop();
      camRef.current.close();
      camRef.current = null;
    }
  }, []);

  const publishMic = useCallback(async () => {
    if (!clientRef.current) return;
    if (!micRef.current) {
      micRef.current = await AgoraRTC.createMicrophoneAudioTrack();
    }
    await clientRef.current.publish(micRef.current);
  }, []);

  const unpublishMic = useCallback(async () => {
    if (clientRef.current && micRef.current) {
      await clientRef.current.unpublish(micRef.current);
      micRef.current.stop();
      micRef.current.close();
      micRef.current = null;
    }
  }, []);

  return useMemo(() => ({
    joined,
    remoteUsers,
    error,
    refreshInSec,
    start,
    leave,
    publishCamera,
    unpublishCamera,
    publishMic,
    unpublishMic,
  }), [joined, remoteUsers, error, refreshInSec, start, leave, publishCamera, unpublishCamera, publishMic, unpublishMic]);
}
