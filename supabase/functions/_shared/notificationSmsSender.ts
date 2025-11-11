interface SendNotificationSmsParams {
  phoneNumber: string;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Sends notification SMS via Twilio
 * Used ONLY by handleNotifications function for general notifications
 * Does NOT handle 2FA SMS (send-2fa-sms remains separate)
 */
export async function sendNotificationSms(params: SendNotificationSmsParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioMessagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

  if (!twilioAccountSid || !twilioAuthToken || !twilioMessagingServiceSid) {
    console.error("[NotificationSmsSender] Twilio not configured");
    return { success: false, error: "SMS service not configured" };
  }

  try {
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
          To: params.phoneNumber,
          Body: params.message
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!twilioResponse.ok) {
        const errorText = await twilioResponse.text();
        console.error("[NotificationSmsSender] Twilio API error:", errorText);
        return { success: false, error: errorText };
      }

      const result = await twilioResponse.json();
      console.log("[NotificationSmsSender] SMS sent successfully:", result.sid);
      return { success: true, messageId: result.sid };
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.log("[NotificationSmsSender] Twilio timeout after 12s, treating as queued");
        return { success: true }; // Treat timeout as queued
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("[NotificationSmsSender] Failed to send SMS:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
