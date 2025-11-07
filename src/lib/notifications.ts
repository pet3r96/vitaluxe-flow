import { supabase } from "@/integrations/supabase/client";

export interface SendNotificationParams {
  userId: string;
  practiceId?: string;
  eventType: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  sendEmail?: boolean;
  sendSms?: boolean;
  actionUrl?: string;
}

/**
 * Unified notification API wrapper
 * Handles both in-app notification creation and dispatch via email/SMS
 */
export async function sendNotification({
  userId,
  practiceId,
  eventType,
  title,
  message,
  metadata = {},
  sendEmail = true,
  sendSms = false,
  actionUrl,
}: SendNotificationParams) {
  try {
    // Create in-app notification record
    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .insert([{
        user_id: userId,
        notification_type: eventType,
        title,
        message,
        metadata,
        action_url: actionUrl,
        read: false,
      }])
      .select()
      .single();

    if (notificationError) {
      throw notificationError;
    }

    // Dispatch via send-notification edge function (handles email & SMS)
    const { data: dispatchResult, error: dispatchError } = await supabase.functions.invoke(
      "send-notification",
      {
        body: {
          notification_id: notification.id,
          send_email: sendEmail,
          send_sms: sendSms,
        },
      }
    );

    if (dispatchError) {
      console.error("Notification dispatch error:", dispatchError);
      // Don't throw - in-app notification was created successfully
      return { notification, dispatchResult: null, dispatchError };
    }

    return { notification, dispatchResult, dispatchError: null };
  } catch (error) {
    console.error("Error sending notification:", error);
    throw error;
  }
}

/**
 * Convenience function for appointment confirmations
 */
export async function sendAppointmentConfirmation(params: {
  userId: string;
  practiceId: string;
  appointmentId: string;
  dateTime: string;
  providerName: string;
  practiceName: string;
}) {
  return sendNotification({
    userId: params.userId,
    practiceId: params.practiceId,
    eventType: "appointment_confirmed",
    title: "Appointment Confirmed",
    message: `Your appointment has been confirmed for ${new Date(params.dateTime).toLocaleString()}`,
    metadata: {
      appointment_id: params.appointmentId,
      date_time: params.dateTime,
      provider_name: params.providerName,
      practice_name: params.practiceName,
    },
    sendEmail: true,
    sendSms: true,
    actionUrl: `/appointments/${params.appointmentId}`,
  });
}

/**
 * Convenience function for appointment reminders
 */
export async function sendAppointmentReminder(params: {
  userId: string;
  practiceId: string;
  appointmentId: string;
  dateTime: string;
  providerName: string;
  practiceName: string;
}) {
  return sendNotification({
    userId: params.userId,
    practiceId: params.practiceId,
    eventType: "appointment_reminder",
    title: "Appointment Reminder",
    message: `Reminder: Your appointment is scheduled for ${new Date(params.dateTime).toLocaleString()}`,
    metadata: {
      appointment_id: params.appointmentId,
      date_time: params.dateTime,
      provider_name: params.providerName,
      practice_name: params.practiceName,
    },
    sendEmail: true,
    sendSms: true,
    actionUrl: `/appointments/${params.appointmentId}`,
  });
}

/**
 * Convenience function for appointment cancellations
 */
export async function sendAppointmentCancellation(params: {
  userId: string;
  practiceId: string;
  appointmentId: string;
  dateTime: string;
  providerName: string;
  practiceName: string;
}) {
  return sendNotification({
    userId: params.userId,
    practiceId: params.practiceId,
    eventType: "appointment_cancelled",
    title: "Appointment Cancelled",
    message: `Your appointment scheduled for ${new Date(params.dateTime).toLocaleString()} has been cancelled`,
    metadata: {
      appointment_id: params.appointmentId,
      date_time: params.dateTime,
      provider_name: params.providerName,
      practice_name: params.practiceName,
    },
    sendEmail: true,
    sendSms: true,
  });
}

/**
 * Convenience function for patient messages
 */
export async function sendPatientMessageNotification(params: {
  userId: string;
  practiceId: string;
  fromName: string;
  messagePreview: string;
  conversationId?: string;
}) {
  return sendNotification({
    userId: params.userId,
    practiceId: params.practiceId,
    eventType: "patient_message_received",
    title: "New Message",
    message: `${params.fromName}: ${params.messagePreview}`,
    metadata: {
      from_name: params.fromName,
      conversation_id: params.conversationId,
    },
    sendEmail: false,
    sendSms: false, // Usually don't SMS for messages
    actionUrl: params.conversationId ? `/messages/${params.conversationId}` : "/messages",
  });
}
