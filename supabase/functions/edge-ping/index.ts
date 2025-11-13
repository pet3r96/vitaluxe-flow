import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve((req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const res = {
    ok: true,
    timestamp: new Date().toISOString(),
    region: Deno.env.get("SUPABASE_REGION") ?? "unknown"
  };

  return new Response(JSON.stringify(res), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    }
  });
});
