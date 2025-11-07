import { supabase } from "@/integrations/supabase/client";

/**
 * Admin Notification Helper
 * Creates notifications for all admin users
 */

export interface AdminNotificationParams {
  title: string;
  message: string;
  notification_type: 'new_signup' | 'system_error' | 'support_message' | 'security_alert' | 'admin_action_required';
  severity: 'info' | 'warning' | 'error';
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a notification for all admin users (respecting their preferences)
 * Used by edge functions to alert admins of system events
 */
export async function createAdminNotification(params: AdminNotificationParams): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Query all users with 'admin' role
    const { data: adminRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (rolesError) {
      console.error('[adminNotifications] Failed to fetch admin users:', rolesError);
      return { success: false, count: 0, error: rolesError.message };
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.warn('[adminNotifications] No admin users found');
      return { success: true, count: 0 };
    }

    // Fetch preferences for all admins for this notification type
    const { data: preferences } = await supabase
      .from('admin_notification_preferences')
      .select('user_id, email_enabled, sms_enabled')
      .eq('notification_type', params.notification_type)
      .or('email_enabled.eq.false,sms_enabled.eq.false'); // Fetch those with at least one channel disabled

    // Create a set of user IDs who have disabled ALL channels for this notification type
    const disabledUserIds = new Set(
      preferences?.filter(p => !p.email_enabled && !p.sms_enabled).map(p => p.user_id) || []
    );

    // Filter admins based on preferences (include if no preference set or if enabled)
    const enabledAdmins = adminRoles.filter(role => !disabledUserIds.has(role.user_id));

    if (enabledAdmins.length === 0) {
      console.log('[adminNotifications] No admins have this notification type enabled');
      return { success: true, count: 0 };
    }

    // Create notification for each admin with notifications enabled
    const notifications = enabledAdmins.map(role => ({
      user_id: role.user_id,
      title: params.title,
      message: params.message,
      notification_type: params.notification_type,
      severity: params.severity,
      entity_type: params.entity_type || null,
      entity_id: params.entity_id || null,
      action_url: params.action_url || null,
      metadata: params.metadata || {},
      read: false,
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('[adminNotifications] Failed to insert notifications:', insertError);
      return { success: false, count: 0, error: insertError.message };
    }

    console.log(`[adminNotifications] Created ${notifications.length} admin notifications (${adminRoles.length - enabledAdmins.length} admins opted out)`);
    return { success: true, count: notifications.length };
  } catch (error: any) {
    console.error('[adminNotifications] Unexpected error:', error);
    return { success: false, count: 0, error: error.message };
  }
}
