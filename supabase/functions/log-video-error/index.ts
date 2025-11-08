import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { sessionId, errorCode, errorMessage, errorName, joinParams, browserInfo } = await req.json();

    // Get user info if authenticated
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    // Log the error to video_session_logs
    const { data, error: insertError } = await supabaseClient
      .from("video_session_logs")
      .insert({
        session_id: sessionId,
        event_type: "join_error",
        user_id: user?.id || null,
        user_type: joinParams?.isProvider ? "provider" : "patient",
        event_data: {
          error_code: errorCode,
          error_message: errorMessage,
          error_name: errorName,
          join_params: joinParams,
          browser_info: browserInfo,
          timestamp: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert error log:", insertError);
      throw insertError;
    }

    console.log("✅ Video error logged:", {
      errorCode,
      errorMessage,
      sessionId,
      logId: data?.id
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        logId: data?.id,
        message: "Error logged successfully" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in log-video-error function:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
