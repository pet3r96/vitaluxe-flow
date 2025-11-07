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
 * Create a notification for all admin users
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

    // Create notification for each admin
    const notifications = adminRoles.map(role => ({
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

    console.log(`[adminNotifications] Created ${notifications.length} admin notifications`);
    return { success: true, count: notifications.length };
  } catch (error: any) {
    console.error('[adminNotifications] Unexpected error:', error);
    return { success: false, count: 0, error: error.message };
  }
}
