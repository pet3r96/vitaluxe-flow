import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapNotificationTypeToEventType } from "../_shared/notificationMapping.ts";
import { sendNotificationEmail } from "../_shared/notificationEmailSender.ts";
import { sendNotificationSms } from "../_shared/notificationSmsSender.ts";
import { logNotificationDelivery } from "../_shared/notificationLogger.ts";

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();
    console.log('[handleNotifications] Processing:', payload);

    // Step 1: Map notification_type to event_type
    const eventType = mapNotificationTypeToEventType(payload.notification_type);
    console.log(`[handleNotifications] Type mapping: ${payload.notification_type} → ${eventType}`);

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
    console.log('[handleNotifications] Channel decisions:', {
      userPreferences: { emailEnabled, smsEnabled, inAppEnabled },
      practiceSettings: { practiceEmailEnabled, practiceSmsEnabled },
      userContact: { 
        hasEmail: !!profile?.email, 
        hasPhone: !!userPhone,
        phoneNormalized: userPhone ? normalizePhoneToE164(userPhone).substring(0, 5) + '***' : null
      },
      willSend: {
        email: emailEnabled && practiceEmailEnabled && !!profile?.email,
        sms: smsEnabled && practiceSmsEnabled && !!userPhone,
        inApp: inAppEnabled
      }
    });

    // Step 6: Send email if enabled
    if (emailEnabled && practiceEmailEnabled && profile?.email) {
      const recipientName = profile.full_name || profile.name || 'Valued User';
      const emailSubject = payload.title || 'Notification from Vitaluxe';

      const emailResult = await sendNotificationEmail({
        to: profile.email,
        recipientName,
        subject: emailSubject,
        title: payload.title,
        message: payload.message,
        actionUrl: payload.metadata?.join_links?.patient || payload.action_url
      });

      if (emailResult.success) {
        results.channels_sent.push('email');
      } else {
        results.errors.push(`Email failed: ${emailResult.error}`);
      }

      await logNotificationDelivery({
        notificationId,
        userId: payload.user_id,
        channel: 'email',
        status: emailResult.success ? 'sent' : 'failed',
        externalId: emailResult.messageId,
        errorMessage: emailResult.error,
        supabaseClient: supabase
      });
    } else if (emailEnabled && !practiceEmailEnabled) {
      console.log('[handleNotifications] Email blocked by practice settings');
      results.errors.push('Email disabled at practice level');
    }

    // Step 7: Send SMS if enabled
    if (smsEnabled && practiceSmsEnabled && userPhone) {
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
    } else if (smsEnabled && !practiceSmsEnabled) {
      console.log('[handleNotifications] SMS blocked by practice settings');
      results.errors.push('SMS disabled at practice level');
    } else if (smsEnabled && !userPhone) {
      console.log('[handleNotifications] SMS enabled but no phone number found');
      results.errors.push('No phone number available');
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
