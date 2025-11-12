import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = import.meta.env.VITE_AGORA_APP_ID;

export default function AgoraDebugSuite() {
  const [sessionId, setSessionId] = useState("");
  const [tokenResult, setTokenResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestTokens() {
    setError(null);

    try {
      const channel = `debug_${sessionId.trim().replace(/-/g, "_")}`;

      const { data, error } = await supabase.functions.invoke("agora-token", {
        body: {
          channel,
          role: "publisher",
          uid: `debug_${Date.now()}`
        }
      });

      if (error) throw error;
      setTokenResult(data);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    }
  }

  return (
    <div className="p-8 space-y-6 text-foreground">
      <h1 className="text-3xl font-bold">Agora Debug Suite</h1>

      <div className="space-y-4">
        <label className="font-semibold">Session ID</label>
        <input
          className="px-3 py-2 bg-muted rounded border border-border w-80"
          placeholder="enter any test sessionId"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        />

        <button
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          onClick={requestTokens}
        >
          Request Tokens
        </button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {tokenResult && (
        <div className="p-4 bg-muted rounded border border-border">
          <h2 className="text-xl font-bold mb-2">Token Response</h2>
          <pre className="text-sm whitespace-pre-wrap">
            {JSON.stringify(tokenResult, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-10 border-t border-border pt-6">
        <h2 className="text-xl font-bold">Device Diagnostics</h2>
        <p className="text-muted-foreground">
          Use this to verify browser permissions and camera/microphone validity.
        </p>
      </div>
    </div>
  );
}
