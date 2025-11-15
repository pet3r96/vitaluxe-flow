import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { mapNotificationTypeToEventType } from "../_shared/notificationMapping.ts";
import { sendNotificationSms } from "../_shared/notificationSmsSender.ts";
import { generateNotificationEmailHTML, generateNotificationEmailText } from "../_shared/emailTemplates.ts";
import { logNotificationDelivery } from "../_shared/notificationLogger.ts";
import { shouldCheckPracticeSettings, getNotificationCategory } from "../_shared/notificationTypeClassifier.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  action_url?: string;
  entity_type?: string;
  entity_id?: string;
}

// Helper function to normalize phone numbers to E.164 format
function normalizePhoneToE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If already starts with +, return as-is
  if (phone.startsWith('+')) return phone;
  
  // If 10 digits, assume US number
  if (digits.length === 10) return `+1${digits}`;
  
  // If 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  
  // Return with + prefix for other cases
  return `+${digits}`;
}

serve(async (req) => {
  console.log('[handleNotifications] ===== NEW REQUEST RECEIVED =====');
  console.log('[handleNotifications] Timestamp:', new Date().toISOString());
  console.log('[handleNotifications] Method:', req.method);
  console.log('[handleNotifications] Headers:', Object.fromEntries(req.headers));
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();
    console.log('[handleNotifications] Supabase admin client created');

    const payload: NotificationPayload = await req.json();
    console.log('[handleNotifications] ===== PAYLOAD RECEIVED =====');
    console.log('[handleNotifications] Full Payload:', JSON.stringify(payload, null, 2));
    console.log('[handleNotifications] User ID:', payload.user_id);
    console.log('[handleNotifications] Type:', payload.notification_type);
    console.log('[handleNotifications] Title:', payload.title);

    // Step 1: Map notification_type to event_type
    const eventType = mapNotificationTypeToEventType(payload.notification_type);
    console.log(`[handleNotifications] Type mapping: ${payload.notification_type} → ${eventType}`);

    // Determine if this notification should respect practice settings
    const respectPracticeSettings = shouldCheckPracticeSettings(payload.notification_type);
    const notificationCategory = getNotificationCategory(payload.notification_type);
    
    console.log('[handleNotifications] Notification classification:', {
      type: payload.notification_type,
      category: notificationCategory,
      respectsPracticeSettings: respectPracticeSettings
    });

    // Step 2: Fetch user preferences
    const { data: preferences, error: prefError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', payload.user_id)
      .eq('event_type', eventType)
      .single();

    if (prefError) {
      console.log('[handleNotifications] No preferences found, using defaults');
    }

    const emailEnabled = preferences?.email_enabled ?? true;
    const smsEnabled = preferences?.sms_enabled ?? true;
    const inAppEnabled = preferences?.in_app_enabled ?? true;

    // Step 3: Check if all channels disabled
    if (!emailEnabled && !smsEnabled && !inAppEnabled) {
      console.log('[handleNotifications] All channels disabled, skipping notification');
      
      // Log skipped status for all channels
      await logNotificationDelivery({
        userId: payload.user_id,
        channel: 'email',
        status: 'skipped',
        supabaseClient: supabase
      });
      await logNotificationDelivery({
        userId: payload.user_id,
        channel: 'sms',
        status: 'skipped',
        supabaseClient: supabase
      });
      await logNotificationDelivery({
        userId: payload.user_id,
        channel: 'in_app',
        status: 'skipped',
        supabaseClient: supabase
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          channels_sent: [], 
          message: 'All channels disabled' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      success: true,
      channels_sent: [] as string[],
      errors: [] as string[]
    };

    let notificationId: string | undefined;

    // Step 4: Handle in-app notifications
    if (inAppEnabled) {
      const { data: notificationData, error: insertError } = await supabase
        .from('notifications')
        .insert({
          user_id: payload.user_id,
          notification_type: payload.notification_type,
          title: payload.title,
          message: payload.message,
          severity: 'info',
          metadata: payload.metadata || {},
          action_url: payload.action_url,
          entity_type: payload.entity_type,
          entity_id: payload.entity_id,
          read: false
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[handleNotifications] Failed to create in-app notification:', insertError);
        results.errors.push(`In-app failed: ${insertError.message}`);
        await logNotificationDelivery({
          userId: payload.user_id,
          channel: 'in_app',
          status: 'failed',
          errorMessage: insertError.message,
          supabaseClient: supabase
        });
      } else {
        notificationId = notificationData.id;
        results.channels_sent.push('in_app');
        await logNotificationDelivery({
          notificationId,
          userId: payload.user_id,
          channel: 'in_app',
          status: 'sent',
          supabaseClient: supabase
        });
      }
    }

    // Step 5: Fetch user profile and practice settings
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, name, full_name, phone')
      .eq('id', payload.user_id)
      .single();

    // Try to get phone from patient_accounts if not in profiles
    let userPhone = profile?.phone;
    
    let practiceId: string | null = null;
    const { data: patientAccount } = await supabase
      .from('patient_accounts')
      .select('practice_id, phone')
      .eq('user_id', payload.user_id)
      .single();

    if (patientAccount) {
      practiceId = patientAccount.practice_id;
      // Use phone from patient_accounts if profiles.phone is null
      if (!userPhone && patientAccount.phone) {
        userPhone = patientAccount.phone;
        console.log('[handleNotifications] Using phone from patient_accounts');
      }
    } else {
      const { data: practiceAccount } = await supabase
        .from('practice_accounts')
        .select('practice_id')
        .eq('user_id', payload.user_id)
        .single();
      
      if (practiceAccount) {
        practiceId = practiceAccount.practice_id;
      }
    }

    let practiceEmailEnabled = true;
    let practiceSmsEnabled = true;

    if (practiceId) {
      const { data: practiceSettings, error: settingsError } = await supabase
        .from('practice_automation_settings')
        .select('enable_email_notifications, enable_sms_notifications')
        .eq('practice_id', practiceId)
        .single();

      if (settingsError) {
        console.log('[handleNotifications] Practice settings not found, defaulting to enabled');
      } else if (practiceSettings) {
        practiceEmailEnabled = practiceSettings.enable_email_notifications ?? true;
        practiceSmsEnabled = practiceSettings.enable_sms_notifications ?? true;
      }
    }

    // Enhanced debug logging for channel decisions
    const shouldSendEmail = emailEnabled && profile?.email && (!respectPracticeSettings || practiceEmailEnabled);
    const shouldSendSms = smsEnabled && userPhone && (!respectPracticeSettings || practiceSmsEnabled);
    
    console.log('[handleNotifications] Channel decisions:', {
      notificationCategory,
      respectsPracticeSettings: respectPracticeSettings,
      userPreferences: { emailEnabled, smsEnabled, inAppEnabled },
      practiceSettings: { practiceEmailEnabled, practiceSmsEnabled },
      userContact: { 
        hasEmail: !!profile?.email, 
        hasPhone: !!userPhone,
        phoneNormalized: userPhone ? normalizePhoneToE164(userPhone).substring(0, 5) + '***' : null
      },
      willSend: {
        email: shouldSendEmail,
        sms: shouldSendSms,
        inApp: inAppEnabled
      }
    });

    // Step 6: Send email if enabled
    console.log('[handleNotifications] Email decision:', {
      notificationType: payload.notification_type,
      userPreference: emailEnabled,
      practiceSettings: practiceEmailEnabled,
      respectsPractice: respectPracticeSettings,
      finalDecision: shouldSendEmail,
      blockReason: !shouldSendEmail ? 
        (!emailEnabled ? 'user_disabled' : 
         !profile?.email ? 'no_email' : 
         'practice_disabled_automation') : null
    });
    
    if (shouldSendEmail) {
      const recipientName = profile.full_name || profile.name || 'Valued User';
      const emailSubject = payload.title || 'Notification from Vitaluxe';

      const htmlBody = generateNotificationEmailHTML({
        recipientName,
        title: payload.title,
        message: payload.message,
        actionUrl: payload.metadata?.join_links?.patient || payload.action_url
      });

      const textBody = generateNotificationEmailText({
        recipientName,
        title: payload.title,
        message: payload.message,
        actionUrl: payload.metadata?.join_links?.patient || payload.action_url
      });

      try {
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('unified-email-sender', {
          body: {
            type: 'notification',
            to: profile.email,
            subject: emailSubject,
            htmlBody,
            textBody,
            userId: payload.user_id,
            eventType
          }
        });

        if (!emailError && emailResult?.success) {
          results.channels_sent.push('email');
        } else {
          results.errors.push(`Email failed: ${emailError?.message || emailResult?.error}`);
        }

        await logNotificationDelivery({
          notificationId,
          userId: payload.user_id,
          channel: 'email',
          status: (!emailError && emailResult?.success) ? 'sent' : 'failed',
          externalId: emailResult?.messageId,
          errorMessage: emailError?.message || emailResult?.error,
          supabaseClient: supabase
        });
      } catch (error: any) {
        console.error('[handleNotifications] Email sending error:', error);
        results.errors.push(`Email failed: ${error.message}`);
        await logNotificationDelivery({
          notificationId,
          userId: payload.user_id,
          channel: 'email',
          status: 'failed',
          supabaseClient: supabase,
          errorMessage: error.message
        });
      }
    } else {
      const blockReason = !emailEnabled ? 'User disabled email notifications' :
                          !profile?.email ? 'No email address on file' :
                          respectPracticeSettings && !practiceEmailEnabled ? 
                            'Practice disabled automation emails' : 'Unknown';
      
      console.log(`[handleNotifications] Email not sent: ${blockReason}`);
      
      if (!emailEnabled) {
        results.errors.push('Email disabled by user preference');
      } else if (respectPracticeSettings && !practiceEmailEnabled) {
        results.errors.push('Email disabled by practice automation settings');
      } else if (!profile?.email) {
        results.errors.push('No email address on file');
      }
    }

    // Step 7: Send SMS if enabled
    console.log('[handleNotifications] SMS decision:', {
      notificationType: payload.notification_type,
      userPreference: smsEnabled,
      practiceSettings: practiceSmsEnabled,
      respectsPractice: respectPracticeSettings,
      finalDecision: shouldSendSms,
      blockReason: !shouldSendSms ? 
        (!smsEnabled ? 'user_disabled' : 
         !userPhone ? 'no_phone' : 
         'practice_disabled_automation') : null
    });
    
    if (shouldSendSms) {
      const normalizedPhone = normalizePhoneToE164(userPhone);
      console.log(`[handleNotifications] Sending SMS to ${normalizedPhone.substring(0, 5)}***`);
      
      // Format SMS message with join link for video appointments
      let smsMessage = `${payload.title}\n\n${payload.message}`;
      if (payload.metadata?.join_links?.patient) {
        smsMessage += `\n\nJoin video call: ${payload.metadata.join_links.patient}`;
      } else {
        smsMessage += `\n\nView in portal: https://app.vitaluxeservices.com`;
      }

      const smsResult = await sendNotificationSms({
        phoneNumber: normalizedPhone,
        message: smsMessage,
        metadata: payload.metadata
      });

      if (smsResult.success) {
        results.channels_sent.push('sms');
      } else {
        results.errors.push(`SMS failed: ${smsResult.error}`);
      }

      await logNotificationDelivery({
        notificationId,
        userId: payload.user_id,
        channel: 'sms',
        status: smsResult.success ? 'sent' : 'failed',
        externalId: smsResult.messageId,
        errorMessage: smsResult.error,
        supabaseClient: supabase
      });
    } else {
      const blockReason = !smsEnabled ? 'User disabled SMS notifications' :
                          !userPhone ? 'No phone number on file' :
                          respectPracticeSettings && !practiceSmsEnabled ? 
                            'Practice disabled automation SMS' : 'Unknown';
      
      console.log(`[handleNotifications] SMS not sent: ${blockReason}`);
      
      if (!smsEnabled) {
        results.errors.push('SMS disabled by user preference');
      } else if (respectPracticeSettings && !practiceSmsEnabled) {
        results.errors.push('SMS disabled by practice automation settings');
      } else if (!userPhone) {
        results.errors.push('No phone number available');
      }
    }

    console.log('[handleNotifications] Completed:', results);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[handleNotifications] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
