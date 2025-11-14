/**
 * Notification Preferences Module
 * Evaluates user-level notification preferences ONLY
 * NO practice-level or pharmacy-level isolation
 */

import { supabase } from "@/integrations/supabase/client";
import { validateRecipientEmail } from "./emailValidation";

export interface PreferenceEvaluation {
  allowed: boolean;
  reason: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
}

/**
 * Evaluates if a user should receive a notification email
 * Checks ONLY user-level preferences (no practice override)
 * 
 * @param userId - User to evaluate preferences for
 * @param eventType - Event type (e.g., 'new_message', 'order_shipped')
 * @param userEmail - User's email address
 */
export async function evaluateNotificationPreferences({
  userId,
  eventType,
  userEmail,
}: {
  userId: string;
  eventType: string;
  userEmail: string;
}): Promise<PreferenceEvaluation> {
  
  // STEP 1: Validate email
  const emailValidation = validateRecipientEmail(userEmail);
  if (!emailValidation.valid) {
    return {
      allowed: false,
      reason: `invalid_email: ${emailValidation.reason}`,
      emailEnabled: false,
      smsEnabled: false,
      inAppEnabled: false,
    };
  }

  // STEP 2: Query user preferences
  const { data: preference, error } = await supabase
    .from('notification_preferences')
    .select('email_enabled, sms_enabled, in_app_enabled')
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .maybeSingle();

  if (error) {
    console.error('[NotificationPreferences] Error fetching preferences:', error);
    return {
      allowed: false,
      reason: 'database_error',
      emailEnabled: false,
      smsEnabled: false,
      inAppEnabled: false,
    };
  }

  // STEP 3: Apply defaults if no preference row exists
  // Default: ALL notifications enabled (true, true, true)
  const emailEnabled = preference?.email_enabled ?? true;
  const smsEnabled = preference?.sms_enabled ?? true;
  const inAppEnabled = preference?.in_app_enabled ?? true;

  // STEP 4: Determine if allowed
  if (!emailEnabled) {
    return {
      allowed: false,
      reason: 'user_disabled',
      emailEnabled: false,
      smsEnabled,
      inAppEnabled,
    };
  }

  return {
    allowed: true,
    reason: 'user_enabled',
    emailEnabled: true,
    smsEnabled,
    inAppEnabled,
  };
}

/**
 * Checks if a user has ANY notification preferences configured
 * Useful for detecting users who need preference rows created
 */
export async function hasPreferencesConfigured(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('notification_preferences')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error('[NotificationPreferences] Error checking preferences:', error);
    return false;
  }

  return (count ?? 0) > 0;
}

/**
 * Gets all event types that exist in the system
 * Used for backfilling missing preferences
 */
export async function getAllEventTypes(): Promise<string[]> {
  // These are the canonical event types used in notification_preferences
  return [
    'new_message',
    'appointment_confirmation',
    'appointment_reschedule',
    'appointment_cancellation',
    'appointment_reminder',
    'order_shipped',
    'order_delivered',
    'order_updates',
    'payment_received',
    'payment_failed',
    'payment_updates',
    'subscription_updates',
    'system_alerts',
    'security_notifications',
    'form_assigned',
    'form_completed',
    'practice_announcements',
    'support_requests',
    'user_activity',
  ];
}
