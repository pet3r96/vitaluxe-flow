/**
 * Shared email template generation for edge functions
 * These templates are used when sending notifications via unified-email-sender
 */

const portalUrl = 'https://app.vitaluxeservices.com';

interface NotificationEmailParams {
  recipientName: string;
  title: string;
  message: string;
  actionUrl?: string;
  senderContext?: {
    role?: string;
    name?: string | null;
    fromName?: string;
  };
}

export function generateNotificationEmailHTML(params: NotificationEmailParams): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif; line-height: 1.6; color: #E2C977; background-color: #0B0B0B; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #0B0B0B; }
        .header { background-color: #0B0B0B; padding: 40px 20px; text-align: center; border-bottom: 1px solid #292929; }
        .logo { height: 80px; width: auto; max-width: 300px; margin: 0 auto; display: block; }
        .content { background-color: #1A1A1A; padding: 40px 30px; border: none; }
        .content h2 { color: #E2C977; margin-top: 0; font-size: 24px; font-weight: 600; margin-bottom: 20px; }
        .content p { color: #E2C977; font-size: 15px; line-height: 1.7; margin: 16px 0; }
        .greeting { color: #E2C977; font-size: 16px; margin-bottom: 24px; font-weight: 500; }
        .sender-context { color: #C8A64B; font-size: 14px; margin-bottom: 20px; font-style: italic; }
        .button { display: inline-block; background-color: #C8A64B; color: #0B0B0B; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 25px 0; font-weight: 600; font-size: 15px; transition: background-color 0.2s ease; }
        .button:hover { background-color: #E2C977; }
        .preferences { border-top: 1px solid #292929; padding-top: 20px; margin-top: 30px; color: #8E6E1E; font-size: 12px; }
        .preferences a { color: #C8A64B; text-decoration: none; }
        .preferences a:hover { color: #E2C977; }
        .footer { text-align: center; padding: 30px 20px; color: #8E6E1E; font-size: 13px; background-color: #0B0B0B; border-top: 1px solid #292929; }
        .footer a { color: #C8A64B; text-decoration: none; }
        .footer a:hover { color: #E2C977; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img 
            src="https://app.vitaluxeservices.com/images/vitaluxe-logo.png" 
            alt="Vitaluxe Services" 
            class="logo"
          />
        </div>
        <div class="content">
          <p class="greeting">Dear ${params.recipientName},</p>
          ${params.senderContext?.name 
            ? `<p class="sender-context">You have a new notification from <strong>${params.senderContext.role}${params.senderContext.name ? ' - ' + params.senderContext.name : ''}</strong>.</p>` 
            : ''
          }
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
          <p><a href="${portalUrl}">Visit Portal</a> | <a href="${portalUrl}/support">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateNotificationEmailText(params: NotificationEmailParams): string {
  return `
${params.title}

Dear ${params.recipientName},

${params.senderContext?.name 
  ? `You have a new notification from ${params.senderContext.role}${params.senderContext.name ? ' - ' + params.senderContext.name : ''}.`
  : ''
}

${params.message}

Please log into app.vitaluxeservices.com to view this message.

Click here to view in portal: ${params.actionUrl || portalUrl}

To change your notification preferences, please log into your secure portal at https://app.vitaluxeservices.com, and go to Settings > My Profile to edit your preferences.

© ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.
  `.trim();
}
