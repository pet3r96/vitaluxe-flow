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

    // Parse Twilio webhook form data
    const formData = await req.formData();
    const body = (formData.get("Body") || "").toString().trim().toLowerCase();
    const from = formData.get("From")?.toString() || "";
    const messageSid = formData.get("MessageSid")?.toString();

    console.log("Inbound SMS:", { from, body, messageSid });

    // Handle STOP/UNSUBSCRIBE
    if (body === "stop" || body === "unsubscribe" || body === "stopall") {
      // Find user by phone number (check both formats)
      const phoneClean = from.replace(/\D/g, '');
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .or(`phone.eq.${from},phone.eq.${phoneClean},mobile_phone.eq.${from},mobile_phone.eq.${phoneClean}`)
        .limit(1);

      const profile = profiles?.[0];

      if (profile) {
        // Disable all SMS notifications for this user
        await supabase
          .from("notification_preferences")
          .update({ sms_enabled: false })
          .eq("user_id", profile.id);

        console.log(`User ${profile.id} opted out of SMS`);
      }

      // Log inbound message
      await supabase.from("notification_logs").insert({
        user_id: profile?.id,
        channel: "sms",
        direction: "inbound",
        event_type: "opt_out",
        sender: from,
        message_body: body,
        status: "received",
        external_id: messageSid
      });

      // Respond with TwiML
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>You have been unsubscribed from Vitaluxe Services notifications. Reply START to opt back in.</Message>
        </Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Handle START
    if (body === "start" || body === "subscribe") {
      const phoneClean = from.replace(/\D/g, '');
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .or(`phone.eq.${from},phone.eq.${phoneClean},mobile_phone.eq.${from},mobile_phone.eq.${phoneClean}`)
        .limit(1);

      const profile = profiles?.[0];

      if (profile) {
        await supabase
          .from("notification_preferences")
          .update({ sms_enabled: true })
          .eq("user_id", profile.id);

        console.log(`User ${profile.id} opted in to SMS`);
      }

      await supabase.from("notification_logs").insert({
        user_id: profile?.id,
        channel: "sms",
        direction: "inbound",
        event_type: "opt_in",
        sender: from,
        message_body: body,
        status: "received",
        external_id: messageSid
      });

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>You have been subscribed to Vitaluxe Services notifications. Reply STOP to unsubscribe.</Message>
        </Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Handle HELP
    if (body === "help" || body === "info") {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>Vitaluxe Services Notifications. For support, contact support@vitaluxeservices.com or call (561) 886-8226. Reply STOP to opt out.</Message>
        </Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Log other inbound messages
    const phoneClean = from.replace(/\D/g, '');
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .or(`phone.eq.${from},phone.eq.${phoneClean},mobile_phone.eq.${from},mobile_phone.eq.${phoneClean}`)
      .limit(1);
    
    const profile = profiles?.[0];

    await supabase.from("notification_logs").insert({
      user_id: profile?.id,
      channel: "sms",
      direction: "inbound",
      event_type: "message_received",
      sender: from,
      message_body: body,
      status: "received",
      external_id: messageSid
    });

    // No response for other messages
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );

  } catch (error) {
    console.error("Twilio inbound error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }
});
