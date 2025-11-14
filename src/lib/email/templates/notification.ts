/**
 * Notification Email Template
 * Used for all notification emails that respect user preferences
 */

import { wrapEmailTemplate, createTextVersion } from './shared';

export interface NotificationEmailVariables {
  recipientName: string;
  title: string;
  message: string;
  actionUrl?: string;
  senderContext?: {
    role?: string;
    name?: string;
    fromName?: string;
  };
}

export function generateNotificationEmail(vars: NotificationEmailVariables) {
  const portalUrl = 'https://app.vitaluxeservices.com';

  const content = `
    <div class="content">
      <p class="greeting">Dear ${vars.recipientName},</p>
      ${vars.senderContext?.name 
        ? `<p style="color: #C8A64B; font-size: 14px; margin-bottom: 20px; font-style: italic;">
             You have a new notification from <strong>${vars.senderContext.role}${vars.senderContext.name ? ' - ' + vars.senderContext.name : ''}</strong>.
           </p>` 
        : ''
      }
      <h2>${vars.title}</h2>
      <p>${vars.message}</p>
      <p>Please log into <a href="${portalUrl}" style="color: #C8A64B; text-decoration: none;">app.vitaluxeservices.com</a> to view this message.</p>
      <div style="text-align: center;">
        <a href="${vars.actionUrl || portalUrl}" class="button">View in Portal</a>
      </div>
      <div style="border-top: 1px solid #292929; padding-top: 20px; margin-top: 30px; color: #8E6E1E; font-size: 12px;">
        <p>To change your notification preferences, please log into your secure portal at <a href="${portalUrl}" style="color: #C8A64B; text-decoration: none;">https://app.vitaluxeservices.com</a>, and go to Settings &gt; My Profile to edit your preferences.</p>
      </div>
    </div>
  `;

  const htmlBody = wrapEmailTemplate(content);
  const textBody = createTextVersion(`
    ${vars.title}
    
    Dear ${vars.recipientName},
    
    ${vars.senderContext?.name 
      ? `You have a new notification from ${vars.senderContext.role}${vars.senderContext.name ? ' - ' + vars.senderContext.name : ''}.`
      : ''
    }
    
    ${vars.message}
    
    Please log into app.vitaluxeservices.com to view this message.
    
    Click here to view in portal: ${vars.actionUrl || portalUrl}
    
    To change your notification preferences, please log into your secure portal at https://app.vitaluxeservices.com, and go to Settings > My Profile to edit your preferences.
    
    © ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.
  `);

  return {
    htmlBody,
    textBody,
  };
}
