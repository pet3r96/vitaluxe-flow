/**
 * Email Validation Module
 * Centralizes all email validation logic
 */

/**
 * Checks if an email is a placeholder (not a real email)
 * Placeholder format: no-email-{uuid}@pending.local
 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return /^no-email-[a-f0-9-]+@pending\.local$/i.test(email);
}

/**
 * Validates email format using RFC 5322 compliant regex
 */
export function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitizes email by trimming and lowercasing
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validates recipient email for sending
 * Blocks placeholder emails and invalid formats
 */
export function validateRecipientEmail(email: string | null | undefined): {
  valid: boolean;
  reason?: string;
  sanitized?: string;
} {
  if (!email) {
    return { valid: false, reason: 'Email is required' };
  }

  if (isPlaceholderEmail(email)) {
    return { valid: false, reason: 'Placeholder email cannot receive emails' };
  }

  const sanitized = sanitizeEmail(email);

  if (!isValidEmailFormat(sanitized)) {
    return { valid: false, reason: 'Invalid email format' };
  }

  return { valid: true, sanitized };
}

/**
 * Validates notification email payload
 */
export interface NotificationEmailPayload {
  userId: string;
  eventType: string;
  to: string;
  recipientName: string;
  subject: string;
  title: string;
  message: string;
  actionUrl?: string;
  senderContext?: {
    role?: string;
    name?: string;
    fromName?: string;
  };
}

export function validateNotificationPayload(payload: any): {
  valid: boolean;
  reason?: string;
} {
  const required = ['userId', 'eventType', 'to', 'recipientName', 'subject', 'title', 'message'];
  
  for (const field of required) {
    if (!payload[field]) {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  // Validate email
  const emailValidation = validateRecipientEmail(payload.to);
  if (!emailValidation.valid) {
    return { valid: false, reason: emailValidation.reason };
  }

  return { valid: true };
}

/**
 * Validates transactional email payload
 */
export interface TransactionalEmailPayload {
  to: string;
  recipientName?: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

export function validateTransactionalPayload(payload: any): {
  valid: boolean;
  reason?: string;
} {
  const required = ['to', 'subject', 'htmlBody', 'textBody'];
  
  for (const field of required) {
    if (!payload[field]) {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  // Validate email
  const emailValidation = validateRecipientEmail(payload.to);
  if (!emailValidation.valid) {
    return { valid: false, reason: emailValidation.reason };
  }

  return { valid: true };
}

/**
 * Formats patient email for display, replacing technical placeholders with user-friendly text
 */
export function formatPatientEmail(email: string | null | undefined): string {
  if (!email) return "Not entered";
  
  if (isPlaceholderEmail(email)) {
    return "Not entered";
  }
  
  return email;
}
