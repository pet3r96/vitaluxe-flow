import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { event_type = 'appointment_booked', user_id } = await req.json();
    
    console.log(`[test-notification] Testing notifications for event: ${event_type}, user: ${user_id || 'auto-detect'}`);

    // Step 1: Auto-detect user if not provided (use Demo Practice 1)
    const testUserId = user_id || '2feb9460-5943-4f23-a2a5-1801103c2952';
    
    // Step 2: Enable all notification preferences for this user
    console.log('[test-notification] Enabling all notification preferences...');
    const { error: prefError } = await supabaseClient
      .from('notification_preferences')
      .upsert({
        user_id: testUserId,
        event_type: event_type,
        email_enabled: true,
        sms_enabled: true,
        in_app_enabled: true,
      }, { onConflict: 'user_id,event_type' });

    if (prefError) {
      console.error('[test-notification] Error enabling preferences:', prefError);
    }

    // Step 3: Get user profile for contact info
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email, phone, practice_id')
      .eq('id', testUserId)
      .single();

    if (profileError) {
      throw new Error(`Failed to get user profile: ${profileError.message}`);
    }

    console.log('[test-notification] User profile:', { email: profile.email, phone: profile.phone });

    // Step 4: Ensure practice-level notifications are enabled
    if (profile.practice_id) {
      console.log('[test-notification] Enabling practice-level notifications...');
      await supabaseClient
        .from('practice_automation_settings')
        .upsert({
          practice_id: profile.practice_id,
          enable_email_notifications: true,
          enable_sms_notifications: true,
        }, { onConflict: 'practice_id' });
    }

    // Step 5: Create a test notification
    console.log('[test-notification] Creating test notification...');
    const { data: notification, error: notifError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id: testUserId,
        notification_type: event_type,
        title: `🧪 TEST: ${event_type}`,
        message: `This is an automated test notification for event type: ${event_type}. Timestamp: ${new Date().toISOString()}`,
        read: false,
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
        }
      })
      .select()
      .single();

    if (notifError) {
      throw new Error(`Failed to create notification: ${notifError.message}`);
    }

    console.log('[test-notification] Notification created:', notification.id);

    // Step 6: Call send-notification function to trigger email/SMS
    console.log('[test-notification] Triggering send-notification function...');
    const { data: sendResult, error: sendError } = await supabaseClient.functions.invoke(
      'send-notification',
      {
        body: {
          notification_id: notification.id,
          send_email: true,
          send_sms: true,
        }
      }
    );

    console.log('[test-notification] send-notification result:', sendResult);
    if (sendError) {
      console.error('[test-notification] send-notification error:', sendError);
    }

    // Step 7: Compile results
    const results = {
      success: true,
      test_timestamp: new Date().toISOString(),
      event_type,
      user_id: testUserId,
      notification_id: notification.id,
      channels: {
        in_app: {
          enabled: true,
          status: notification ? 'created' : 'failed',
          notification_id: notification?.id,
        },
        email: {
          enabled: true,
          status: sendResult?.emailSent ? 'sent' : 'failed',
          recipient: profile.email,
          error: sendResult?.emailError,
        },
        sms: {
          enabled: true,
          status: sendResult?.smsSent ? 'sent' : 'failed',
          recipient: profile.phone,
          error: sendResult?.smsError,
        },
      },
      preferences_enabled: {
        email: true,
        sms: true,
        in_app: true,
      },
      practice_settings: {
        email_enabled: true,
        sms_enabled: true,
      },
      logs: {
        send_notification_result: sendResult,
        send_notification_error: sendError,
      }
    };

    console.log('[test-notification] Test complete. Results:', results);

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[test-notification] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});