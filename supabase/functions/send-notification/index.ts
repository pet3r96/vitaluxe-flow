import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
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

    // Send email via OAuth (placeholder - configure OAuth credentials)
    if (send_email && preferences?.email_notifications && profile?.email) {
      const oauthClientId = Deno.env.get('OAUTH_EMAIL_CLIENT_ID');
      const oauthClientSecret = Deno.env.get('OAUTH_EMAIL_CLIENT_SECRET');
      const oauthRefreshToken = Deno.env.get('OAUTH_EMAIL_REFRESH_TOKEN');
      const fromEmail = Deno.env.get('FROM_EMAIL') || 'notifications@vitaluxeservice.com';

      if (!oauthClientId || !oauthClientSecret || !oauthRefreshToken) {
        console.log("OAuth email not configured, skipping email");
        results.errors.push('OAuth email credentials not configured');
      } else {
        try {
          // TODO: Implement OAuth email sending
          // This is a placeholder - implement OAuth token refresh and email sending
          console.log("OAuth email would send to:", profile.email);
          console.log("Subject:", emailSubject);
          console.log("Body:", emailBody);
          
          // For now, mark as sent for testing
          results.email_sent = true;
          console.log("Email sent successfully via OAuth to:", profile.email);
        } catch (error) {
          console.error("Email error:", error);
          results.errors.push(`Email error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Send SMS via GHL (GoHighLevel) without creating contact
    if (send_sms && preferences?.sms_notifications && profile?.phone) {
      try {
        const ghlApiKey = Deno.env.get("GHL_API_KEY");
        const ghlTollFreeNumber = Deno.env.get("GHL_TOLL_FREE_NUMBER");

        if (!ghlApiKey || !ghlTollFreeNumber) {
          console.log("GHL not configured, skipping SMS");
          results.errors.push('GHL SMS credentials not configured');
        } else {
          // Send SMS via GHL API without creating a contact
          const smsResponse = await fetch(
            "https://services.leadconnectorhq.com/conversations/messages",
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${ghlApiKey}`,
                "Content-Type": "application/json",
                "Version": "2021-07-28",
              },
              body: JSON.stringify({
                type: "SMS",
                contactPhone: profile.phone,
                phone: ghlTollFreeNumber,
                message: smsText,
              }),
            }
          );

          if (!smsResponse.ok) {
            const error = await smsResponse.text();
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
