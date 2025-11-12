import { useEffect, useState, useRef } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalVideoTrack,
  ILocalAudioTrack
} from "agora-rtc-sdk-ng";
import { supabase } from "@/integrations/supabase/client";

const APP_ID = import.meta.env.VITE_AGORA_APP_ID;

export default function AgoraDebugSuite() {
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

  const debug = (msg: string, data?: any) => {
    setLog((prev) => [
      `[${new Date().toISOString()}] ${msg}${data ? " " + JSON.stringify(data) : ""}`,
      ...prev
    ]);
  };

  // ============================
  // FETCH TOKENS
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

    debug("Requesting Agora tokens", { channel });

    try {
      const { data, error } = await supabase.functions.invoke("agora-token", {
        body: {
          channel,
          role: "publisher",
          uid: "debug_" + Date.now(),
          ttl: 3600
        }
      });

      if (error) throw error;

      debug("Token response", data);
      setTokenData(data);
    } catch (err: any) {
      setError(err.message);
      debug("Token fetch error", err);
    }
  }

  // ============================
  // START PUBLISHER
  // ============================
  async function startPublisher() {
    if (!tokenData?.rtcToken) {
      setError("No RTC token found");
      return;
    }

    const rtc = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    setClient(rtc);

    await rtc.join(APP_ID, channelName, tokenData.rtcToken, null);

    debug("Creating tracks...");

    const audio = await AgoraRTC.createMicrophoneAudioTrack();
    const video = await AgoraRTC.createCameraVideoTrack();

    setLocalAudioTrack(audio);
    setLocalVideoTrack(video);

    video.play(localVideoRef.current!);

    await rtc.publish([audio, video]);

    debug("Local stream published");
  }

  // ============================
  // SUBSCRIBE TO REMOTE USERS
  // ============================
  function enableRemoteSubscription() {
    if (!client) return;

    client.on("user-published", async (user: IAgoraRTCRemoteUser, mediaType) => {
      debug("User published", { uid: user.uid, mediaType });
      await client.subscribe(user, mediaType);

      if (mediaType === "video") {
        user.videoTrack?.play(remoteVideoRef.current!);
      }
      if (mediaType === "audio") {
        user.audioTrack?.play();
      }
    });

    client.on("user-unpublished", (user) =>
      debug("Remote user unpublished", { uid: user.uid })
    );
  }

  // ============================
  // MICROPHONE WAVEFORM FIXED
  // ============================
  useEffect(() => {
    if (!localAudioTrack) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();

    // FIXED: wrap track in a MediaStream
    const mediaStreamTrack = localAudioTrack.getMediaStreamTrack();
    const mediaStream = new MediaStream([mediaStreamTrack]);
    const source = audioContext.createMediaStreamSource(mediaStream);

    source.connect(analyser);

    const canvas = micMeterRef.current;
    const ctx = canvas?.getContext("2d");

    const draw = () => {
      if (!canvas || !ctx) return;
      requestAnimationFrame(draw);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "#222";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#4ade80";
      ctx.beginPath();

      const sliceWidth = canvas.width / dataArray.length;
      let x = 0;

      dataArray.forEach((v, i) => {
        const y = (v / 128.0) * (canvas.height / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      });

      ctx.stroke();
    };

    draw();
  }, [localAudioTrack]);

  // ============================
  // CLEANUP
  // ============================
  async function cleanup() {
    try {
      localVideoTrack?.stop();
      localVideoTrack?.close();
      localAudioTrack?.stop();
      localAudioTrack?.close();
      await client?.leave();
      debug("Cleanup complete");
    } catch (e) {
      debug("Cleanup error", e);
    }
  }

  return (
    <div className="p-10 text-white space-y-6">
      <h1 className="text-3xl font-bold mb-4">Agora Debug Suite v2</h1>

      <div className="space-y-2">
        <input
          className="bg-gray-800 px-3 py-2 rounded border border-gray-700 w-80"
          placeholder="test-session-id"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        />
        <button onClick={fetchTokens} className="bg-blue-600 px-4 py-2 rounded">
          Fetch Tokens
        </button>
      </div>

      {tokenData && (
        <pre className="bg-gray-900 p-4 rounded border border-gray-700 text-sm">
          {JSON.stringify(tokenData, null, 2)}
        </pre>
      )}

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-2">Local Video</h2>
          <div ref={localVideoRef} className="bg-black h-48 rounded" />

          <h2 className="text-xl font-semibold mt-4 mb-2">Mic Analyzer</h2>
          <canvas
            ref={micMeterRef}
            width={400}
            height={80}
            className="border border-gray-700 rounded"
          />

          <button onClick={startPublisher} className="bg-green-600 px-4 py-2 rounded mt-4">
            Start Publisher
          </button>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Remote Video</h2>
          <div ref={remoteVideoRef} className="bg-black h-48 rounded" />

          <button
            onClick={enableRemoteSubscription}
            className="bg-purple-600 px-4 py-2 rounded mt-4"
          >
            Enable Subscriber
          </button>

          <button
            onClick={cleanup}
            className="bg-red-600 px-4 py-2 rounded mt-4 ml-3"
          >
            Cleanup
          </button>
        </div>
      </div>

      <h2 className="text-xl font-semibold mt-6">Debug Log</h2>
      <pre className="bg-gray-900 p-4 rounded border border-gray-700 text-xs h-64 overflow-auto">
        {log.join("\n")}
      </pre>
    </div>
  );
}
