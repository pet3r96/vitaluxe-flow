/**
 * Email Client
 * Frontend wrapper for calling unified email service
 */

import { supabase } from "@/integrations/supabase/client";
import { 
  generateWelcomeEmail, 
  generatePasswordResetEmail, 
  generateVerificationEmail,
  type WelcomeEmailVariables,
  type PasswordResetEmailVariables,
  type VerificationEmailVariables,
} from "./templates/transactional";
import { 
  generateNotificationEmail,
  type NotificationEmailVariables,
} from "./templates/notification";
import { validateRecipientEmail } from "./emailValidation";

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
  correlationId?: string;
}

/**
 * Send welcome email (transactional - always sends)
 */
export async function sendWelcomeEmail(
  to: string,
  variables: WelcomeEmailVariables
): Promise<EmailResponse> {
  // Validate email
  const validation = validateRecipientEmail(to);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.reason,
    };
  }

  const { subject, htmlBody, textBody } = generateWelcomeEmail(variables);

  const { data, error } = await supabase.functions.invoke('unified-email-sender', {
    body: {
      type: 'transactional',
      to: validation.sanitized,
      subject,
      htmlBody,
      textBody,
    },
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return data;
}

/**
 * Send password reset email (transactional - always sends)
 */
export async function sendPasswordResetEmail(
  to: string,
  variables: PasswordResetEmailVariables
): Promise<EmailResponse> {
  // Validate email
  const validation = validateRecipientEmail(to);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.reason,
    };
  }

  const { subject, htmlBody, textBody } = generatePasswordResetEmail(variables);

  const { data, error } = await supabase.functions.invoke('unified-email-sender', {
    body: {
      type: 'transactional',
      to: validation.sanitized,
      subject,
      htmlBody,
      textBody,
    },
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return data;
}

/**
 * Send email verification (transactional - always sends)
 */
export async function sendVerificationEmail(
  to: string,
  variables: VerificationEmailVariables
): Promise<EmailResponse> {
  // Validate email
  const validation = validateRecipientEmail(to);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.reason,
    };
  }

  const { subject, htmlBody, textBody } = generateVerificationEmail(variables);

  const { data, error } = await supabase.functions.invoke('unified-email-sender', {
    body: {
      type: 'transactional',
      to: validation.sanitized,
      subject,
      htmlBody,
      textBody,
    },
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return data;
}

/**
 * Send notification email (respects user preferences)
 */
export async function sendNotificationEmail(params: {
  userId: string;
  eventType: string;
  to: string;
  subject: string;
  variables: NotificationEmailVariables;
}): Promise<EmailResponse> {
  // Validate email
  const validation = validateRecipientEmail(params.to);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.reason,
    };
  }

  const { htmlBody, textBody } = generateNotificationEmail(params.variables);

  const { data, error } = await supabase.functions.invoke('unified-email-sender', {
    body: {
      type: 'notification',
      userId: params.userId,
      eventType: params.eventType,
      to: validation.sanitized,
      subject: params.subject,
      htmlBody,
      textBody,
    },
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return data;
}
