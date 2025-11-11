interface LogNotificationParams {
  notificationId?: string;
  userId: string;
  channel: 'email' | 'sms' | 'in_app';
  status: 'sent' | 'failed' | 'skipped';
  externalId?: string;
  errorMessage?: string;
  supabaseClient: any;
}

/**
 * Logs notification delivery attempts to notification_logs table
 * Non-blocking - logging failures never stop notification flow
 */
export async function logNotificationDelivery(params: LogNotificationParams): Promise<void> {
  try {
    const { error } = await params.supabaseClient
      .from('notification_logs')
      .insert({
        notification_id: params.notificationId,
        user_id: params.userId,
        channel: params.channel,
        status: params.status,
        external_id: params.externalId,
        error_message: params.errorMessage,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error(`[NotificationLogger] Failed to log ${params.channel} delivery:`, error);
    } else {
      console.log(`[NotificationLogger] Logged ${params.channel} ${params.status} for user ${params.userId}`);
    }
  } catch (error) {
    console.error(`[NotificationLogger] Exception logging delivery:`, error);
    // Don't throw - logging failures shouldn't break notification sending
  }
}
