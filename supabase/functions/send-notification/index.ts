import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
// Removed AWS SES logic - previously used @aws-sdk/client-ses@3.485.0
import { validateSendNotificationRequest } from "../_shared/requestValidators.ts";

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
    // Parse JSON with error handling
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      console.error('Invalid JSON in request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Note: send-notification uses a different pattern - it takes notification_id, not userId/message
    // The validation is for notification_id as UUID
    const { notification_id, send_email = true, send_sms = false } = requestData;
    
    if (!notification_id) {
      return new Response(
        JSON.stringify({ error: 'notification_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { notification_id: notificationId, send_email: sendEmail, send_sms: sendSms }: SendNotificationRequest = requestData;

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
    
    // Get notification preferences for this specific event type
    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", notification.user_id)
      .eq("event_type", notification.notification_type)
      .single();
    
    console.log("Notification preferences for event type:", notification.notification_type, preferences);

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

    // Send Email via Postmark (replaced AWS SES on 2025-10-22)
    if (send_email && preferences?.email_enabled && profile?.email) {
      try {
        const POSTMARK_API_KEY = Deno.env.get("POSTMARK_API_KEY");
        const POSTMARK_FROM_EMAIL = Deno.env.get("POSTMARK_FROM_EMAIL") || "info@vitaluxeservices.com";

        if (!POSTMARK_API_KEY) {
          console.error("POSTMARK_API_KEY not configured");
          results.errors.push("Email service not configured");
        } else {
          const actionButton = notification.action_url 
            ? `<a href="${notification.action_url}" class="button">View Details</a>`
            : '';
          
          const postmarkResponse = await fetch("https://api.postmarkapp.com/email", {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json",
              "X-Postmark-Server-Token": POSTMARK_API_KEY,
            },
            body: JSON.stringify({
              From: POSTMARK_FROM_EMAIL,
              To: profile.email,
              Subject: emailSubject,
              HtmlBody: `
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #E2C977; background-color: #0B0B0B; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .header { background: linear-gradient(135deg, #8E6E1E 0%, #C8A64B 50%, #E2C977 100%); padding: 30px 20px; text-align: center; }
                    .header h1 { margin: 0; color: #0B0B0B; font-size: 28px; font-weight: bold; letter-spacing: 2px; }
                    .content { background-color: #1A1A1A; padding: 40px 30px; border: 1px solid #292929; }
                    .content h2 { color: #E2C977; margin-top: 0; }
                    .content p { color: #E2C977; }
                    .button { display: inline-block; background-color: #C8A64B; color: #0B0B0B; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 25px 0; font-weight: bold; transition: background-color 0.3s; }
                    .button:hover { background-color: #E2C977; }
                    .footer { text-align: center; padding: 25px 20px; color: #8E6E1E; font-size: 12px; background-color: #0B0B0B; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>VITALUXE</h1>
                    </div>
                    <div class="content">
                      <h2>${notification.title}</h2>
                      <p>${notification.message}</p>
                      ${actionButton}
                    </div>
                    <div class="footer">
                      <p>&copy; ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.</p>
                    </div>
                  </div>
                </body>
                </html>
              `,
              TextBody: `${notification.title}\n\n${notification.message}\n\n${notification.action_url ? `View details: ${notification.action_url}\n\n` : ''}Vitaluxe Services`
            }),
          });

          if (!postmarkResponse.ok) {
            const errorText = await postmarkResponse.text();
            console.error("Postmark API error:", errorText);
            results.errors.push(`Email failed: ${errorText}`);
          } else {
            const result = await postmarkResponse.json();
            results.email_sent = true;
            console.log("Notification email sent successfully to:", profile.email, "MessageID:", result.MessageID);
          }
        }
      } catch (error) {
        console.error("Email error:", error);
        results.errors.push(`Email error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Send SMS via GHL webhook
    if (send_sms && preferences?.sms_enabled && profile?.phone) {
      try {
        const ghlWebhookUrl = Deno.env.get("GHL_WEBHOOK_URL");

        if (!ghlWebhookUrl) {
          console.log("GHL webhook not configured, skipping SMS");
        } else {
          const ghlResponse = await fetch(ghlWebhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              phone: profile.phone,
              code: smsText // Send full notification text
            })
          });

          if (!ghlResponse.ok) {
            const error = await ghlResponse.text();
            console.error("GHL SMS send failed:", error);
            results.errors.push(`SMS failed: ${error}`);
          } else {
            results.sms_sent = true;
            console.log("SMS sent successfully via GHL to:", profile.phone);
          }
        }
      } catch (error) {
        console.error("SMS error:", error);
        results.errors.push(`SMS error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in send-notification:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
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
