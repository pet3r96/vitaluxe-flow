import { useEffect, useState, useRef } from "react";
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import { supabase } from "@/integrations/supabase/client";

const APP_ID = import.meta.env.VITE_AGORA_APP_ID;

export default function AgoraDebugSuite() {
  // ============================
  // STATE
  // ============================
  const [sessionId, setSessionId] = useState("");
  const [channelName, setChannelName] = useState("");
  const [tokenData, setTokenData] = useState<any>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ILocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const micMeterRef = useRef<HTMLCanvasElement>(null);

  // ============================
  // LOGGER
  // ============================
  function debug(msg: string, data?: any) {
    setLog((prev) => [`[${new Date().toISOString()}] ${msg}${data ? " " + JSON.stringify(data) : ""}`, ...prev]);
  }

  // ============================
  // REQUEST TOKENS
  // ============================
  async function fetchTokens() {
    setError(null);
    setTokenData(null);

    const cleanSession = sessionId.trim();
    if (!cleanSession) {
      setError("Session ID is required");
      return;
    }

    const channel = `debug_${cleanSession.replace(/-/g, "_")}`;
    setChannelName(channel);

    debug("Requesting Agora tokens for channel", channel);

    try {
      const { data, error } = await supabase.functions.invoke("agora-token", {
        body: {
          channel,
          role: "publisher",
          uid: "debug_user_" + Date.now(),
          ttl: 3600,
        },
      });

      if (error) {
        debug("Token request failed", error);
        throw error;
      }

      debug("Token response", data);
      setTokenData(data);
    } catch (e: any) {
      setError(e.message || "Unknown error");
      debug("Token fetch error", e.message);
    }
  }

  // ============================
  // START PUBLISHER
  // ============================
  async function startPublisher() {
    if (!tokenData?.rtcToken) {
      setError("No RTC token to start publisher.");
      return;
    }

    const rtc = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    setClient(rtc);

    debug("Joining RTC channel...");

    await rtc.join(APP_ID, channelName, tokenData.rtcToken, null);

    debug("Creating local tracks...");
    const mic = await AgoraRTC.createMicrophoneAudioTrack();
    const cam = await AgoraRTC.createCameraVideoTrack();

    setLocalAudioTrack(mic);
    setLocalVideoTrack(cam);

    cam.play(localVideoRef.current!);

    debug("Publishing local tracks...");
    await rtc.publish([mic, cam]);

    debug("Local stream published");
  }

  // ============================
  // START SUBSCRIBER (CONNECT REMOTE USER)
  // ============================
  function enableRemoteSubscription() {
    if (!client) {
      setError("No client initialized.");
      return;
    }

    client.on("user-published", async (user: IAgoraRTCRemoteUser, mediaType) => {
      debug("Remote user published", { uid: user.uid, mediaType });

      await client.subscribe(user, mediaType);

      if (mediaType === "video") {
        debug("Playing remote video");
        user.videoTrack?.play(remoteVideoRef.current!);
      }
      if (mediaType === "audio") {
        user.audioTrack?.play();
      }
    });

    client.on("user-unpublished", (user) => {
      debug("Remote user unpublished", { uid: user.uid });
    });

    debug("Remote subscription enabled");
  }

  // ============================
  // MIC WAVEFORM ANALYZER
  // ============================
  useEffect(() => {
    if (!localAudioTrack) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(localAudioTrack.getMediaStreamTrack().mediaStream);
    source.connect(analyser);

    const canvas = micMeterRef.current;
    const ctx = canvas?.getContext("2d");

    function draw() {
      if (!ctx || !canvas) return;
      requestAnimationFrame(draw);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "#333";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#4ade80"; // green
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }

    draw();
  }, [localAudioTrack]);

  // ============================
  // LEAVE + CLEANUP
  // ============================
  async function cleanup() {
    debug("Cleaning up...");

    try {
      localVideoTrack?.stop();
      localVideoTrack?.close();
      localAudioTrack?.stop();
      localAudioTrack?.close();
      await client?.leave();
    } finally {
      setClient(null);
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
      debug("Cleanup complete");
    }
  }

  // ============================
  // UI
  // ============================
  return (
    <div className="p-8 text-white space-y-6">
      <h1 className="text-3xl font-bold">Agora Debug Suite v2</h1>

      <div className="space-y-2">
        <label className="font-semibold">Session ID</label>
        <input
          className="bg-gray-800 px-3 py-2 rounded border border-gray-700 w-80"
          placeholder="test-session-id"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        />
        <button onClick={fetchTokens} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded">
          Fetch Tokens
        </button>
      </div>

      {tokenData && (
        <pre className="bg-gray-900 p-4 rounded border border-gray-700 text-sm">
          {JSON.stringify(tokenData, null, 2)}
        </pre>
      )}

      <div className="flex space-x-4">
        <div className="w-1/2 space-y-4">
          <h2 className="text-xl font-semibold">Local Video</h2>
          <div ref={localVideoRef} className="bg-black h-48 rounded" />

          <h2 className="text-xl font-semibold">Mic Monitor</h2>
          <canvas ref={micMeterRef} width={400} height={80} className="border border-gray-700 rounded" />

          <button onClick={startPublisher} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded">
            Start Publisher
          </button>
        </div>

        <div className="w-1/2 space-y-4">
          <h2 className="text-xl font-semibold">Remote Video</h2>
          <div ref={remoteVideoRef} className="bg-black h-48 rounded" />

          <button onClick={enableRemoteSubscription} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded">
            Enable Subscriber
          </button>

          <button onClick={cleanup} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded">
            Cleanup
          </button>
        </div>
      </div>

      <h2 className="text-xl font-semibold mt-6">Debug Log</h2>
      <pre className="bg-gray-900 p-4 rounded border border-gray-700 text-xs h-64 overflow-auto">{log.join("\n")}</pre>
    </div>
  );
}
