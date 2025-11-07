import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const formData = await req.formData();
    const messageSid = formData.get("MessageSid")?.toString();
    const messageStatus = formData.get("MessageStatus")?.toString();
    const errorCode = formData.get("ErrorCode")?.toString();
    const errorMessage = formData.get("ErrorMessage")?.toString();

    console.log("Twilio status callback:", { messageSid, messageStatus, errorCode });

    // Update notification log with delivery status
    if (messageSid) {
      const updateData: any = {
        status: messageStatus === "delivered" ? "delivered" : 
                messageStatus === "failed" || messageStatus === "undelivered" ? "failed" : "sent"
      };

      if (messageStatus === "delivered") {
        updateData.delivered_at = new Date().toISOString();
      }

      if (errorCode || errorMessage) {
        updateData.error_message = `${errorCode}: ${errorMessage}`;
      }

      const { error } = await supabase
        .from("notification_logs")
        .update(updateData)
        .eq("external_id", messageSid);

      if (error) {
        console.error("Error updating notification log:", error);
      }
    }

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("Status callback error:", error);
    return new Response("Error", { status: 500 });
  }
});
