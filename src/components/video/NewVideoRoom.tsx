import { useEffect, useState } from "react";
import { useAgoraCall } from "@/hooks/useAgoraCall";

type Props = {
  channel: string;
  uid?: string | number;
  className?: string;
  onLeave?: () => void;
};

export default function NewVideoRoom({ channel, uid, className, onLeave }: Props) {
  const [error, setError] = useState<string | null>(null);
  const call = useAgoraCall({
    channel,
    userId: String(uid || Math.floor(Math.random() * 1e9)),
    autoRenew: true
  });

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        await call.join();
      } catch (e: any) {
        setError(e?.message || 'Failed to join call');
      }
    })();

    return () => {
      call.leave();
    };
  }, [channel, uid]);

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-4 w-full h-full">
        <div className="rounded-xl overflow-hidden border relative">
          <div ref={call.localVideoRef} className="w-full h-[48vh] md:h-[60vh] bg-black" />
          <div className="absolute bottom-2 left-2 text-xs bg-black/50 text-white px-2 py-1 rounded">You</div>
        </div>
        <div className="rounded-xl overflow-hidden border relative">
          <div ref={call.remoteVideoRef} className="w-full h-[48vh] md:h-[60vh] bg-black" />
          <div className="absolute bottom-2 left-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Remote</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          className="px-3 py-2 rounded bg-red-600 text-white"
          onClick={() => { call.leave(); onLeave?.(); }}
        >
          Leave
        </button>

        {!call.isJoined && <span className="text-sm opacity-70">Connecting…</span>}
        {error && <span className="text-sm text-red-600">Error: {error}</span>}
      </div>
    </div>
  );
}
