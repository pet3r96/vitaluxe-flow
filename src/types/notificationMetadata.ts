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

export function isFollowUpMetadata(
  m: unknown
): m is FollowUpNotificationMetadata {
  return !!m && typeof m === "object" && "patient_id" in (m as any);
}

export function isAppointmentMetadata(
  m: unknown
): m is AppointmentNotificationMetadata {
  return !!m && typeof m === "object" && "appointment_id" in (m as any);
}

export function isOrderMetadata(
  m: unknown
): m is OrderNotificationMetadata {
  return !!m && typeof m === "object" && "order_id" in (m as any);
}

export function isMessageMetadata(
  m: unknown
): m is MessageNotificationMetadata {
  return !!m && typeof m === "object" && "thread_id" in (m as any);
}
