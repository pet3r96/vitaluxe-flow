import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve((req) => {
  const res = {
    ok: true,
    timestamp: new Date().toISOString(),
    region: Deno.env.get("SUPABASE_REGION") ?? "unknown"
  };

  return new Response(JSON.stringify(res), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
});
