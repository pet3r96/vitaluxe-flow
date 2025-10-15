import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendNotificationRequest {
  notification_id: string;
  send_email?: boolean;
  send_sms?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { notification_id, send_email = true, send_sms = false }: SendNotificationRequest = await req.json();

    // Get notification details
    const { data: notification, error: notifError } = await supabase
      .from("notifications")
      .select("*, metadata")
      .eq("id", notification_id)
      .single();

    if (notifError || !notification) {
      throw new Error("Notification not found");
    }

    // Get user details and preferences
    const { data: user } = await supabase.auth.admin.getUserById(notification.user_id);
    
    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", notification.user_id)
      .single();

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, phone")
      .eq("id", notification.user_id)
      .single();

    // Get template for email/sms content
    const templateKey = notification.metadata?.template_key;
    let emailSubject = notification.title;
    let emailBody = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${notification.title}</h2>
      <p>${notification.message}</p>
      ${notification.action_url ? `<p><a href="${notification.action_url}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Details</a></p>` : ''}
    </div>`;
    let smsText = `${notification.title}: ${notification.message}`;

    if (templateKey) {
      const { data: template } = await supabase
        .from("notification_templates")
        .select("*")
        .eq("template_key", templateKey)
        .single();

      if (template) {
        emailSubject = replaceVariables(template.email_subject_template || notification.title, notification.metadata);
        emailBody = replaceVariables(template.email_body_template || emailBody, notification.metadata);
        smsText = replaceVariables(template.sms_template || smsText, notification.metadata);
      }
    }

    const results = {
      email_sent: false,
      sms_sent: false,
      errors: [] as string[],
    };

    // Send email if enabled
    if (send_email && preferences?.email_notifications && profile?.email) {
      try {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) {
          console.log("RESEND_API_KEY not configured, skipping email");
        } else {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: "VitaLuxe <notifications@vitaluxeservice.com>",
              to: [profile.email],
              subject: emailSubject,
              html: emailBody,
            }),
          });

          if (!emailResponse.ok) {
            const error = await emailResponse.text();
            console.error("Email send failed:", error);
            results.errors.push(`Email failed: ${error}`);
          } else {
            results.email_sent = true;
            console.log("Email sent successfully to:", profile.email);
          }
        }
      } catch (error) {
        console.error("Email error:", error);
        results.errors.push(`Email error: ${error.message}`);
      }
    }

    // Send SMS if enabled (Twilio integration placeholder)
    if (send_sms && preferences?.sms_notifications && profile?.phone) {
      try {
        const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (!twilioSid || !twilioToken || !twilioFrom) {
          console.log("Twilio not configured, skipping SMS");
        } else {
          const smsResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
              },
              body: new URLSearchParams({
                To: profile.phone,
                From: twilioFrom,
                Body: smsText,
              }),
            }
          );

          if (!smsResponse.ok) {
            const error = await smsResponse.text();
            console.error("SMS send failed:", error);
            results.errors.push(`SMS failed: ${error}`);
          } else {
            results.sms_sent = true;
            console.log("SMS sent successfully to:", profile.phone);
          }
        }
      } catch (error) {
        console.error("SMS error:", error);
        results.errors.push(`SMS error: ${error.message}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in send-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function replaceVariables(template: string, variables: any): string {
  let result = template;
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), String(value));
    }
  }
  return result;
}
