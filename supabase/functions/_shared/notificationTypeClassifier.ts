/**
 * Notification Type Classifier
 * 
 * Determines which notifications should respect practice automation settings.
 * 
 * CRITICAL RULES:
 * 1. User preferences ALWAYS win - if user disables a channel, it's never sent
 * 2. Practice settings ONLY control automation - reminders and follow-ups only
 * 3. User-driven notifications ignore practice settings - messages, orders, payments
 * 4. Transactional emails remain unaffected - welcome, password reset, verification
 */

/**
 * Practice automation notification types
 * These are automated workflows that respect practice-level settings
 */
const PRACTICE_AUTOMATION_TYPES = [
  'appointment_reminder',
  'follow_up_due_today',
  'follow_up_overdue',
  'follow_up_upcoming',
  'subscription_reminder',
] as const;

/**
 * Check if notification type is practice automation
 * 
 * @param notificationType - The notification type to check
 * @returns true if this is a practice automation event that should respect practice settings
 */
export function isPracticeAutomationEvent(notificationType: string): boolean {
  return PRACTICE_AUTOMATION_TYPES.includes(notificationType as any);
}

/**
 * Determine if practice settings should be checked for this notification
 * 
 * Returns true only for practice automation events.
 * User-driven notifications (messages, orders, payments, etc.) should NOT check practice settings.
 * 
 * @param notificationType - The notification type to check
 * @returns true if practice automation settings should be checked
 */
export function shouldCheckPracticeSettings(notificationType: string): boolean {
  return isPracticeAutomationEvent(notificationType);
}

/**
 * Get human-readable category for notification type
 * 
 * @param notificationType - The notification type to categorize
 * @returns 'automation' | 'user-driven' | 'unknown'
 */
export function getNotificationCategory(
  notificationType: string
): 'automation' | 'user-driven' | 'unknown' {
  if (isPracticeAutomationEvent(notificationType)) {
    return 'automation';
  }

  // All other types are user-driven (messages, appointments, orders, payments, documents, system, security, support, provider, staff)
  const userDrivenPattern = /^(message|appointment|order|payment|document|system|security|support|provider|staff)/;
  if (userDrivenPattern.test(notificationType)) {
    return 'user-driven';
  }

  return 'unknown';
}
