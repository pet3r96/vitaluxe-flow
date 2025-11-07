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
    
    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", notification.user_id)
      .eq("event_type", notification.notification_type)
      .single();

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, phone, first_name, last_name, practice_id")
      .eq("id", notification.user_id)
      .single();

    // Load notification template from notification_templates table
    let emailTemplate, smsTemplate;
    
    // Try practice-specific template first
    if (profile?.practice_id) {
      const { data: practiceTemplates } = await supabase
        .from("notification_templates")
        .select("*")
        .eq("practice_id", profile.practice_id)
        .eq("event_type", notification.notification_type)
        .eq("is_active", true);
      
      emailTemplate = practiceTemplates?.find(t => t.channel === "email");
      smsTemplate = practiceTemplates?.find(t => t.channel === "sms");
    }
    
    // Fallback to default templates
    if (!emailTemplate || !smsTemplate) {
      const { data: defaultTemplates } = await supabase
        .from("notification_templates")
        .select("*")
        .is("practice_id", null)
        .eq("event_type", notification.notification_type)
        .eq("is_active", true);
      
      if (!emailTemplate) emailTemplate = defaultTemplates?.find(t => t.channel === "email");
      if (!smsTemplate) smsTemplate = defaultTemplates?.find(t => t.channel === "sms");
    }

    // Prepare template variables
    const templateVars = {
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
      ...notification.metadata
    };

    // Set email content from template or defaults
    let emailSubject = emailTemplate?.subject 
      ? replaceVariables(emailTemplate.subject, templateVars)
      : notification.title;
    
    let emailBody = emailTemplate?.message_template 
      ? replaceVariables(emailTemplate.message_template, templateVars)
      : `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${notification.title}</h2>
          <p>${notification.message}</p>
          ${notification.action_url ? `<p><a href="${notification.action_url}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Details</a></p>` : ''}
        </div>`;
    
    // Set SMS content from template or defaults
    let smsText = smsTemplate?.message_template 
      ? replaceVariables(smsTemplate.message_template, templateVars) + " Reply STOP to opt out."
      : `${notification.title}: ${notification.message}`;

    const results = {
      email_sent: false,
      sms_sent: false,
      errors: [] as string[],
    };

    // Send Email via Postmark (replaced AWS SES on 2025-10-22)
    if (send_email && preferences?.email_enabled !== false && profile?.email) {
      try {
        const POSTMARK_API_KEY = Deno.env.get("POSTMARK_API_KEY");
        const POSTMARK_FROM_EMAIL = Deno.env.get("POSTMARK_FROM_EMAIL") || "info@vitaluxeservices.com";

        if (!POSTMARK_API_KEY) {
          console.error("POSTMARK_API_KEY not configured");
          results.errors.push("Email service not configured");
          
          // Log failed attempt
          await supabase.from("notification_logs").insert({
            practice_id: profile?.practice_id,
            user_id: notification.user_id,
            notification_id: notification.id,
            channel: "email",
            direction: "outbound",
            event_type: notification.notification_type,
            recipient: profile?.email,
            subject: emailSubject,
            message_body: notification.message,
            status: "failed",
            error_message: "Email service not configured"
          });
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
            
            // Log failed email
            await supabase.from("notification_logs").insert({
              practice_id: profile?.practice_id,
              user_id: notification.user_id,
              notification_id: notification.id,
              channel: "email",
              direction: "outbound",
              event_type: notification.notification_type,
              recipient: profile.email,
              subject: emailSubject,
              message_body: notification.message,
              status: "failed",
              error_message: errorText
            });
          } else {
            const result = await postmarkResponse.json();
            results.email_sent = true;
            console.log("Notification email sent successfully to:", profile.email, "MessageID:", result.MessageID);
            
            // Log successful email
            await supabase.from("notification_logs").insert({
              practice_id: profile?.practice_id,
              user_id: notification.user_id,
              notification_id: notification.id,
              channel: "email",
              direction: "outbound",
              event_type: notification.notification_type,
              recipient: profile.email,
              subject: emailSubject,
              message_body: notification.message,
              status: "sent",
              external_id: result.MessageID,
              metadata: { template_id: emailTemplate?.id }
            });
          }
        }
      } catch (error) {
        console.error("Email error:", error);
        results.errors.push(`Email error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Send SMS via Twilio
    if (send_sms && preferences?.sms_enabled !== false && profile?.phone) {
      try {
        const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
        const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
        const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
        const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_PHONE_NUMBER)) {
          console.log("Twilio not configured, skipping SMS");
          results.errors.push("SMS service not configured");
          
          // Log failed attempt
          await supabase.from("notification_logs").insert({
            practice_id: profile?.practice_id,
            user_id: notification.user_id,
            notification_id: notification.id,
            channel: "sms",
            direction: "outbound",
            event_type: notification.notification_type,
            recipient: profile.phone,
            message_body: smsText,
            status: "failed",
            error_message: "SMS service not configured"
          });
        } else {
          // Create Basic Auth header for Twilio API
          const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
          
          // Format phone number for Twilio (add +1 if not present)
          const formattedPhone = profile.phone.startsWith('+') 
            ? profile.phone 
            : `+1${profile.phone.replace(/\D/g, '')}`;
          
          // Prepare SMS parameters - use MessagingServiceSid if available, otherwise use From number
          const smsParams: Record<string, string> = {
            To: formattedPhone,
            Body: smsText,
            StatusCallback: `${SUPABASE_URL}/functions/v1/twilio-status-callback`
          };
          
          // Use Messaging Service (toll-free) if available, otherwise use phone number
          if (TWILIO_MESSAGING_SERVICE_SID) {
            smsParams.MessagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
            console.log("Sending SMS via Twilio Messaging Service (toll-free)");
          } else if (TWILIO_PHONE_NUMBER) {
            smsParams.From = TWILIO_PHONE_NUMBER;
            console.log("Sending SMS via Twilio Phone Number");
          }
          
          // Send SMS via Twilio REST API with StatusCallback
          const twilioResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Authorization": `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams(smsParams).toString()
            }
          );

          if (!twilioResponse.ok) {
            const error = await twilioResponse.json();
            console.error("Twilio SMS send failed:", error);
            results.errors.push(`SMS failed: ${error.message || error.code || 'Unknown error'}`);
            
            // Log failed SMS
            await supabase.from("notification_logs").insert({
              practice_id: profile?.practice_id,
              user_id: notification.user_id,
              notification_id: notification.id,
              channel: "sms",
              direction: "outbound",
              event_type: notification.notification_type,
              recipient: profile.phone,
              message_body: smsText,
              status: "failed",
              error_message: error.message || error.code || 'Unknown error'
            });
          } else {
            const result = await twilioResponse.json();
            results.sms_sent = true;
            console.log("SMS sent successfully via Twilio. SID:", result.sid, "To:", profile.phone);
            
            // Log successful SMS
            await supabase.from("notification_logs").insert({
              practice_id: profile?.practice_id,
              user_id: notification.user_id,
              notification_id: notification.id,
              channel: "sms",
              direction: "outbound",
              event_type: notification.notification_type,
              recipient: profile.phone,
              message_body: smsText,
              status: "sent",
              external_id: result.sid,
              metadata: { template_id: smsTemplate?.id }
            });
          }
        }
      } catch (error) {
        console.error("SMS error:", error);
        results.errors.push(`SMS error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    /* ========== GHL SMS CODE (PRESERVED FOR REFERENCE) ==========
    // Send SMS via GHL webhook
    if (send_sms && preferences?.sms_notifications && profile?.phone) {
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
              code: smsText
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
    ============================================================= */

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
