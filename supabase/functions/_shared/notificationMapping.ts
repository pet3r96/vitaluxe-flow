/**
 * Maps notification_type enum values to event_type preference keys
 * Used ONLY by handleNotifications function for general notifications
 * Does NOT affect 2FA or authentication emails
 */
export function mapNotificationTypeToEventType(notificationType: string): string {
  const mapping: Record<string, string> = {
    // Messages
    'message': 'new_message',
    'practice_message_received': 'new_message',
    'new_patient_message': 'new_message',
    'patient_message_received': 'new_message',
    
    // Appointments  
    'appointment_confirmed': 'appointment_confirmation',
    'appointment_rescheduled': 'appointment_reschedule',
    'appointment_cancelled': 'appointment_cancellation',
    'appointment_reminder': 'appointment_reminder',
    'appointment_update': 'appointment_reminder',
    
    // Orders
    'order_shipped': 'order_shipped',
    'order_delivered': 'order_delivered',
    'order_status': 'order_updates',
    'order_update': 'order_updates',
    'order_issue': 'order_updates',
    
    // Payments
    'payment_method': 'payment_updates',
    'payment_received': 'payment_received',
    'payment_failed': 'payment_failed',
    
    // Subscriptions
    'subscription_reminder': 'subscription_updates',
    'subscription_activated': 'subscription_updates',
    'subscription_suspended': 'subscription_updates',
    'subscription_renewed': 'subscription_updates',
    'subscription_alert': 'subscription_updates',
    
    // System
    'system_announcement': 'system_alerts',
    'account_alert': 'security_notifications',
    'security_alert': 'security_notifications',
    
    // Documents
    'document_assigned': 'form_assigned',
    'document_uploaded_by_patient': 'form_completed',
    
    // Follow-ups
    'follow_up_due_today': 'appointment_reminder',
    'follow_up_overdue': 'appointment_reminder',
    'follow_up_upcoming': 'appointment_reminder',
    'follow_up_assigned': 'form_assigned',
    
    // Approvals
    'practice_approved': 'practice_announcements',
    'rep_approved': 'practice_announcements',
    'product_request_approved': 'system_alerts',
    'product_request_rejected': 'system_alerts',
    
    // Admin
    'admin_action_required': 'system_alerts',
    'support_message': 'support_requests',
    'system_error': 'system_alerts',
    'new_signup': 'user_activity',
    'low_inventory': 'system_alerts',
  };
  
  return mapping[notificationType] || 'system_alerts';
}
