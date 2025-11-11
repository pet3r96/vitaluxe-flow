interface SendNotificationEmailParams {
  to: string;
  recipientName: string;
  subject: string;
  title: string;
  message: string;
  actionUrl?: string;
  senderContext?: {
    role: string;
    name: string | null;
  };
}

/**
 * Sends notification emails via Postmark
 * Used ONLY by handleNotifications function
 * Does NOT handle password resets, welcome emails, or verification emails
 */
export async function sendNotificationEmail(params: SendNotificationEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const POSTMARK_API_KEY = Deno.env.get("POSTMARK_API_KEY");
  const POSTMARK_FROM_EMAIL = Deno.env.get("POSTMARK_FROM_EMAIL") || "info@vitaluxeservices.com";
  const portalUrl = 'https://app.vitaluxeservices.com';

  if (!POSTMARK_API_KEY) {
    console.error("[NotificationEmailSender] POSTMARK_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const postmarkResponse = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": POSTMARK_API_KEY,
      },
      body: JSON.stringify({
        From: POSTMARK_FROM_EMAIL,
        To: params.to,
        Subject: params.subject,
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
              .button { display: inline-block; background-color: #C8A64B; color: #0B0B0B; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 25px 0; font-weight: bold; }
              .button:hover { background-color: #E2C977; }
              .preferences { border-top: 1px solid #292929; padding-top: 20px; margin-top: 30px; color: #8E6E1E; font-size: 12px; }
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
                <p class="greeting">Dear ${params.recipientName},</p>
                ${params.senderContext?.name ? `<p class="sender-context">You have a new notification from <strong>${params.senderContext.role}${params.senderContext.name ? ' - ' + params.senderContext.name : ''}</strong>.</p>` : ''}
                <h2>${params.title}</h2>
                <p>${params.message}</p>
                <p>Please log into <a href="${portalUrl}" style="color: #C8A64B; text-decoration: none;">app.vitaluxeservices.com</a> to view this message.</p>
                <div style="text-align: center;">
                  <a href="${params.actionUrl || portalUrl}" class="button">View in Portal</a>
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
        TextBody: `Dear ${params.recipientName},

${params.senderContext?.name ? `You have a new notification from ${params.senderContext.role}${params.senderContext.name ? ' - ' + params.senderContext.name : ''}.

` : ''}${params.title}

${params.message}

Please log into app.vitaluxeservices.com to view this message.
View in Portal: ${params.actionUrl || portalUrl}

---
To change your notification preferences, please log into your secure portal at https://app.vitaluxeservices.com, and go to Settings > My Profile to edit your preferences.

© ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.`
      }),
    });

    if (!postmarkResponse.ok) {
      const errorText = await postmarkResponse.text();
      console.error("[NotificationEmailSender] Postmark API error:", errorText);
      return { success: false, error: errorText };
    }

    const result = await postmarkResponse.json();
    console.log("[NotificationEmailSender] Email sent successfully:", result.MessageID);
    return { success: true, messageId: result.MessageID };
    
  } catch (error) {
    console.error("[NotificationEmailSender] Failed to send email:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
