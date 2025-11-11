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
      .select("email, phone, name, full_name")
      .eq("id", notification.user_id)
      .single();

    // Get user's practice_id to check practice-level notification settings
    let practiceId = null;
    let practiceEmailEnabled = true; // default to enabled
    let practiceSmsEnabled = true; // default to enabled

    // Check if user is a patient
    const { data: patientAccount } = await supabase
      .from("patient_accounts")
      .select("practice_id")
      .eq("user_id", notification.user_id)
      .single();

    if (patientAccount?.practice_id) {
      practiceId = patientAccount.practice_id;
    } else {
      // Check if user is a provider
      const { data: provider } = await supabase
        .from("providers")
        .select("practice_id")
        .eq("user_id", notification.user_id)
        .single();
      
      if (provider?.practice_id) {
        practiceId = provider.practice_id;
      } else {
        // Check if user is staff
        const { data: staff } = await supabase
          .from("practice_staff")
          .select("practice_id")
          .eq("user_id", notification.user_id)
          .single();
        
        if (staff?.practice_id) {
          practiceId = staff.practice_id;
        }
      }
    }

    // Get practice notification settings if practice_id found
    if (practiceId) {
      const { data: practiceSettings } = await supabase
        .from("practice_automation_settings")
        .select("enable_email_notifications, enable_sms_notifications")
        .eq("practice_id", practiceId)
        .single();
      
      if (practiceSettings) {
        practiceEmailEnabled = practiceSettings.enable_email_notifications ?? true;
        practiceSmsEnabled = practiceSettings.enable_sms_notifications ?? true;
        
        console.log(`Practice ${practiceId} notification settings: email=${practiceEmailEnabled}, sms=${practiceSmsEnabled}`);
      }
    }

    // Get template for SMS based on event_type and channel
    let smsText = '';
    
    // Try to get SMS template from database
    const { data: smsTemplate } = await supabase
      .from("notification_templates")
      .select("message_template")
      .eq("event_type", notification.notification_type)
      .eq("channel", "sms")
      .eq("active", true)
      .is("practice_id", null) // Get default templates
      .single();

    if (smsTemplate?.message_template) {
      // Use template with variable replacement
      smsText = replaceVariables(smsTemplate.message_template, notification.metadata);
    } else {
      // Fallback: Generate concise SMS with sender context
      const senderContext = getSenderContext(notification);
      const senderPrefix = senderContext.name ? `${senderContext.name}: ` : '';
      
      // Truncate message to fit in 160 chars with "Reply STOP to opt out"
      const maxMessageLength = 130 - senderPrefix.length; // Reserve space for opt-out
      let truncatedMessage = notification.message;
      if (truncatedMessage.length > maxMessageLength) {
        truncatedMessage = truncatedMessage.substring(0, maxMessageLength - 3) + '...';
      }
      
      smsText = `${senderPrefix}${truncatedMessage} Reply STOP to opt out.`;
    }

    const results = {
      email_sent: false,
      sms_sent: false,
      errors: [] as string[],
    };

    // Send Email via Postmark (replaced AWS SES on 2025-10-22)
    // Check BOTH user preference AND practice-level setting
    if (send_email && preferences?.email_enabled && practiceEmailEnabled && profile?.email) {
      try {
        const POSTMARK_API_KEY = Deno.env.get("POSTMARK_API_KEY");
        const POSTMARK_FROM_EMAIL = Deno.env.get("POSTMARK_FROM_EMAIL") || "info@vitaluxeservices.com";

        if (!POSTMARK_API_KEY) {
          console.error("POSTMARK_API_KEY not configured");
          results.errors.push("Email service not configured");
        } else {
          // Get recipient name for personalization
          const recipientName = profile.full_name || profile.name || 'Valued User';
          
          // Extract sender context from metadata
          const senderContext = getSenderContext(notification);
          
          // Set email subject
          const emailSubject = notification.title || 'Notification from Vitaluxe';
          
          // Set portal URLs
          const portalUrl = 'https://app.vitaluxeservices.com';
          const actionUrl = notification.action_url || portalUrl;
          
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
                    .greeting { color: #E2C977; font-size: 16px; margin-bottom: 20px; }
                    .sender-context { color: #C8A64B; font-size: 14px; margin-bottom: 20px; font-style: italic; }
                    .button { display: inline-block; background-color: #C8A64B; color: #0B0B0B; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 25px 0; font-weight: bold; transition: background-color 0.3s; }
                    .button:hover { background-color: #E2C977; }
                    .preferences { border-top: 1px solid #292929; padding-top: 20px; margin-top: 30px; color: #8E6E1E; font-size: 12px; line-height: 1.6; }
                    .preferences a { color: #C8A64B; text-decoration: none; }
                    .footer { text-align: center; padding: 25px 20px; color: #8E6E1E; font-size: 12px; background-color: #0B0B0B; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>VITALUXE</h1>
                    </div>
                    <div class="content">
                      <p class="greeting">Dear ${recipientName},</p>
                      ${senderContext.name ? `<p class="sender-context">You have a new notification from <strong>${senderContext.role}${senderContext.name ? ' - ' + senderContext.name : ''}</strong>.</p>` : ''}
                      <h2>${notification.title}</h2>
                      <p>${notification.message}</p>
                      <p>Please log into <a href="${portalUrl}" style="color: #C8A64B; text-decoration: none;">app.vitaluxeservices.com</a> to view this message.</p>
                      <div style="text-align: center;">
                        <a href="${actionUrl}" class="button">View in Portal</a>
                      </div>
                      <div class="preferences">
                        <p>To change your notification preferences, please log into your secure portal at <a href="${portalUrl}">https://app.vitaluxeservices.com</a>, and go to Settings &gt; My Profile to edit your preferences.</p>
                      </div>
                    </div>
                    <div class="footer">
                      <p>&copy; ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.</p>
                    </div>
                  </div>
                </body>
                </html>
              `,
              TextBody: `Dear ${recipientName},

${senderContext.name ? `You have a new notification from ${senderContext.role}${senderContext.name ? ' - ' + senderContext.name : ''}.

` : ''}${notification.title}

${notification.message}

Please log into app.vitaluxeservices.com to view this message.
View in Portal: ${actionUrl}

---
To change your notification preferences, please log into your secure portal at https://app.vitaluxeservices.com, and go to Settings > My Profile to edit your preferences.

© ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.`
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
    } else if (send_email && preferences?.email_enabled && !practiceEmailEnabled) {
      console.log(`Email blocked by practice-level settings for practice ${practiceId}`);
      results.errors.push("Email disabled at practice level");
    }

    // Send SMS via Twilio
    // Check BOTH user preference AND practice-level setting
    if (send_sms && preferences?.sms_enabled && practiceSmsEnabled && profile?.phone) {
      try {
        const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioMessagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

        if (!twilioAccountSid || !twilioAuthToken || !twilioMessagingServiceSid) {
          console.log("Twilio credentials not configured, skipping SMS");
          results.errors.push("SMS service not configured");
        } else {
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
          const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          
          try {
            const twilioResponse = await fetch(twilioUrl, {
              method: 'POST',
              headers: { 
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                MessagingServiceSid: twilioMessagingServiceSid,
                To: profile.phone,
                Body: smsText
              }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!twilioResponse.ok) {
              const errorText = await twilioResponse.text();
              console.error("Twilio SMS send failed:", errorText);
              results.errors.push(`SMS failed: ${errorText}`);
            } else {
              results.sms_sent = true;
              console.log("SMS sent successfully via Twilio to:", profile.phone);
            }
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
              console.log("Twilio SMS timeout after 12s, treating as queued");
              results.sms_sent = true; // Treat timeout as queued/sent
            } else {
              throw fetchError;
            }
          }
        }
      } catch (error) {
        console.error("SMS error:", error);
        results.errors.push(`SMS error: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (send_sms && preferences?.sms_enabled && !practiceSmsEnabled) {
      console.log(`SMS blocked by practice-level settings for practice ${practiceId}`);
      results.errors.push("SMS disabled at practice level");
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

// Helper function to determine sender context based on notification type and metadata
function getSenderContext(notification: any): { role: string, name: string | null } {
  const metadata = notification.metadata || {};
  const notificationType = notification.notification_type || '';
  
  // Extract sender name from metadata (various possible fields)
  const senderName = metadata.from_name || 
                     metadata.provider_name || 
                     metadata.practice_name ||
                     metadata.sender_name ||
                     metadata.patient_name ||
                     null;
  
  // Determine role based on notification type
  let senderRole = 'Vitaluxe Team';
  
  if (notificationType.startsWith('appointment_')) {
    senderRole = 'Provider';
  } else if (notificationType.startsWith('message')) {
    // Could be from patient or provider - check metadata
    if (metadata.sender_role) {
      senderRole = metadata.sender_role === 'patient' ? 'Patient' : 'Provider';
    } else {
      senderRole = 'Team Member';
    }
  } else if (notificationType.startsWith('order_') || notificationType.startsWith('prescription_')) {
    senderRole = metadata.pharmacy_name ? 'Pharmacy' : 'Provider';
  } else if (notificationType.startsWith('system_')) {
    senderRole = 'Vitaluxe System';
  } else if (notificationType.includes('shipment') || notificationType.includes('tracking')) {
    senderRole = 'Shipping';
  }
  
  return { role: senderRole, name: senderName };
}
