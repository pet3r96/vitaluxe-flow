import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * VIOS Integration is currently DISABLED
 * 
 * This edge function has been disabled as part of a temporary removal of VIOS support.
 * To re-enable VIOS integration, restore this file from git history.
 * 
 * Last functional version: See git history before this change
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ 
      success: false, 
      error: "VIOS integration is currently disabled",
      code: "VIOS_DISABLED",
      message: "The VIOS pharmacy integration has been temporarily disabled. Please assign products to a different pharmacy."
    }),
    { 
      status: 410, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
});
