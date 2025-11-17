/**
 * Notifications Domain Types
 * Centralized type definitions for notification and alert systems
 */

// ============= Base Notification Types =============

export type NotificationType = 
  | 'order_status'
  | 'appointment_reminder'
  | 'message_received'
  | 'follow_up_due'
  | 'system_alert'
  | 'payment_received'
  | 'refund_processed';

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';

export interface BaseNotification {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  action_url?: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  read_at?: string;
  created_at: string;
  expires_at?: string;
}

// ============= Notification Metadata Types =============

export interface BaseNotificationMetadata {
  timestamp?: string;
  triggered_by?: string;
}

export interface FollowUpNotificationMetadata extends BaseNotificationMetadata {
  patient_id: string;
  follow_up_id?: string;
  follow_up_title?: string;
  due_date?: string;
}

export interface AppointmentNotificationMetadata extends BaseNotificationMetadata {
  appointment_id: string;
  patient_name: string;
  provider_name?: string;
  appointment_time?: string;
}

export interface OrderNotificationMetadata extends BaseNotificationMetadata {
  order_id: string;
  order_number: string;
  total_amount?: number;
  status?: string;
}

export interface MessageNotificationMetadata extends BaseNotificationMetadata {
  thread_id: string;
  message_preview: string;
  sender_name?: string;
}

export type NotificationMetadata =
  | FollowUpNotificationMetadata
  | AppointmentNotificationMetadata
  | OrderNotificationMetadata
  | MessageNotificationMetadata
  | Record<string, unknown>;

// ============= Notification Preferences =============

export interface NotificationChannel {
  email: boolean;
  sms: boolean;
  inApp: boolean;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  event_type: string;
  role?: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  channels?: NotificationChannel;
  created_at: string;
  updated_at: string;
}

export interface NotificationSettings {
  [eventType: string]: NotificationChannel;
}

// ============= Notification Templates =============

export type NotificationChannelType = 'email' | 'sms' | 'in_app';

export interface NotificationTemplate {
  id: string;
  event_type: string;
  channel: NotificationChannelType;
  subject?: string;
  message_template: string;
  variables?: Record<string, unknown>;
  practice_id?: string;
  is_default: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ============= Admin Alerts =============

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AdminAlert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  entity_type?: string;
  entity_id?: string;
  pharmacy_id?: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by_user_id?: string;
  created_at: string;
  updated_at: string;
  pharmacies?: {
    name: string;
  };
}

// ============= Type Guards =============

export function isFollowUpMetadata(
  m: unknown
): m is FollowUpNotificationMetadata {
  return !!m && typeof m === "object" && "patient_id" in m;
}

export function isAppointmentMetadata(
  m: unknown
): m is AppointmentNotificationMetadata {
  return !!m && typeof m === "object" && "appointment_id" in m;
}

export function isOrderMetadata(
  m: unknown
): m is OrderNotificationMetadata {
  return !!m && typeof m === "object" && "order_id" in m;
}

export function isMessageMetadata(
  m: unknown
): m is MessageNotificationMetadata {
  return !!m && typeof m === "object" && "thread_id" in m;
}
