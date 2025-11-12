import { useMemo, useState } from "react";
import NewVideoRoom from "@/components/video/NewVideoRoom";

export default function AgoraSmokeTest() {
  const [channel, setChannel] = useState(`vlx_${crypto.randomUUID().replace(/-/g,'_')}`);
  const [join, setJoin] = useState(false);
  const uid = useMemo(() => Math.floor(Math.random()*1e9), []);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Agora 1:1 Smoke Test</h1>

      <div className="flex items-center gap-2">
        <input
          className="border px-2 py-1 rounded w-[360px]"
          value={channel}
          onChange={(e)=>setChannel(e.target.value)}
          placeholder="channel name"
        />
        {!join ? (
          <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={()=>setJoin(true)}>Join</button>
        ) : (
          <button className="px-3 py-2 rounded bg-gray-200" onClick={()=>setJoin(false)}>Reset</button>
        )}
      </div>

      {join && (
        <NewVideoRoom
          className="mt-2"
          channel={channel}
          uid={uid}
          onLeave={()=>setJoin(false)}
        />
      )}
    </div>
  );
}
