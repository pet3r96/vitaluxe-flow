import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createAdminClient();

    console.log("Starting log archival process...");

    // Call the database function
    const { data, error } = await supabaseClient.rpc("archive_old_audit_logs");

    if (error) throw error;

    console.log(`Successfully archived ${data} logs`);

    return new Response(
      JSON.stringify({ success: true, archived_count: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error archiving logs:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
