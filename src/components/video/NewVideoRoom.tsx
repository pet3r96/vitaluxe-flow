import { useEffect, useRef, useState } from "react";
import { useAgoraCall } from "@/hooks/useAgoraCall";

type Props = {
  channel: string;                  // required
  uid?: string | number;
  className?: string;               // preserve your existing layout classes
  onLeave?: () => void;
};

export default function NewVideoRoom({ channel, uid, className, onLeave }: Props) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const remoteRef = useRef<HTMLDivElement | null>(null);
  const [starting, setStarting] = useState(false);

  const call = useAgoraCall();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        setStarting(true);
        cleanup = await call.start({
          channel,
          uid,
          role: "publisher",
          ttlSeconds: 3600,
          containerLocal: localRef.current,
          containerRemote: remoteRef.current
        });
      } catch (e:any) {
        // swallow; the hook exposes error
      } finally {
        setStarting(false);
      }
    })();
    return () => {
      cleanup?.();
      call.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, uid]);

  return (
    <div className={className}>
      {/* Preserve your layout: just replace inner video canvases */}
      <div className="grid grid-cols-2 gap-4 w-full h-full">
        <div className="rounded-xl overflow-hidden border relative">
          <div ref={localRef} className="w-full h-[48vh] md:h-[60vh] bg-black" />
          <div className="absolute bottom-2 left-2 text-xs bg-black/50 text-white px-2 py-1 rounded">You</div>
        </div>
        <div className="rounded-xl overflow-hidden border relative">
          <div ref={remoteRef} className="w-full h-[48vh] md:h-[60vh] bg-black" />
          <div className="absolute bottom-2 left-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Remote</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-50"
          onClick={() => { call.leave(); onLeave?.(); }}
        >
          Leave
        </button>
        <button className="px-3 py-2 rounded border" onClick={() => call.publishMic()}>Mic On</button>
        <button className="px-3 py-2 rounded border" onClick={() => call.unpublishMic()}>Mic Off</button>
        <button className="px-3 py-2 rounded border" onClick={() => call.publishCamera()}>Camera On</button>
        <button className="px-3 py-2 rounded border" onClick={() => call.unpublishCamera()}>Camera Off</button>

        {starting && <span className="text-sm opacity-70">Starting…</span>}
        {call.error && <span className="text-sm text-red-600">Error: {call.error}</span>}
      </div>
    </div>
  );
}
