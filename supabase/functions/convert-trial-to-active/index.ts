import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const { edgeLogger } = await import("../_shared/logger.ts");
    edgeLogger.info('Checking for expired trials to convert');

    // Get trials that have ended
    const { data: expiredTrials } = await supabaseClient
      .from("practice_subscriptions")
      .select(`
        id,
        practice_id,
        trial_ends_at,
        profiles!practice_subscriptions_practice_id_fkey (
          id,
          name,
          email,
          authorizenet_customer_profile_id
        )
      `)
      .eq("status", "trial")
      .lt("trial_ends_at", now.toISOString());

    edgeLogger.info('Found expired trials', { count: expiredTrials?.length || 0 });

    const results = [];

    for (const trial of expiredTrials || []) {
      const profile = trial.profiles as any;
      const hasPaymentMethod = profile.authorizenet_customer_profile_id != null;

      edgeLogger.info('Processing expired trial', { practiceName: profile.name, hasPaymentMethod });

      if (hasPaymentMethod) {
        // Attempt to charge first payment
        try {
          edgeLogger.info('Attempting to charge first payment', { subscriptionId: trial.id });
          
          const paymentResponse = await supabaseClient.functions.invoke(
            "process-subscription-payment",
            { body: { subscriptionId: trial.id } }
          );

          if (paymentResponse.data?.success) {
            // Payment successful - convert to active
            const nextPeriodEnd = new Date(now);
            nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

            await supabaseClient
              .from("practice_subscriptions")
              .update({
                status: "active",
                current_period_start: now.toISOString(),
                current_period_end: nextPeriodEnd.toISOString(),
                updated_at: now.toISOString()
              })
              .eq("id", trial.id);

            // Create success notification
            await supabaseClient.functions.invoke('handleNotifications', {
              body: {
                user_id: trial.practice_id,
                notification_type: 'subscription_activated',
                title: '✅ VitaLuxePro Subscription Activated',
                message: `Your trial has ended and your subscription is now active. Your next billing date is ${nextPeriodEnd.toLocaleDateString()}.`,
                metadata: {
                  subscription_id: trial.id,
                  billing_amount: 500.00,
                  next_billing_date: nextPeriodEnd.toISOString()
                }
              }
            });

            results.push({ 
              subscription_id: trial.id, 
              status: "activated", 
              next_billing_date: nextPeriodEnd.toISOString() 
            });
            
            edgeLogger.info('Successfully activated subscription', { subscriptionId: trial.id });
          } else {
            throw new Error(paymentResponse.data?.error || "Payment failed");
          }
        } catch (error: any) {
          edgeLogger.error('Payment failed for subscription', error, { subscriptionId: trial.id });
          
          // Payment failed - suspend subscription with grace period
          const gracePeriodEnd = new Date(now);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3); // 3-day grace period

          await supabaseClient
            .from("practice_subscriptions")
            .update({
              status: "suspended",
              grace_period_ends_at: gracePeriodEnd.toISOString(),
              last_payment_attempt_at: now.toISOString(),
              updated_at: now.toISOString()
            })
            .eq("id", trial.id);

          // Create urgent notification
          await supabaseClient.functions.invoke('handleNotifications', {
            body: {
              user_id: trial.practice_id,
              notification_type: 'payment_failed',
              title: '⚠️ Payment Failed - Action Required',
              message: `We couldn't process your payment. Please update your payment method within 3 days to avoid service interruption.`,
              action_url: '/profile',
              metadata: {
                subscription_id: trial.id,
                grace_period_ends: gracePeriodEnd.toISOString(),
                error: error.message
              }
            }
          });

          results.push({ 
            subscription_id: trial.id, 
            status: "suspended", 
            reason: "payment_failed",
            grace_period_ends: gracePeriodEnd.toISOString() 
          });
        }
      } else {
        // No payment method - suspend with grace period
        edgeLogger.info('No payment method for subscription, suspending', { subscriptionId: trial.id });
        
        const gracePeriodEnd = new Date(now);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);

        await supabaseClient
          .from("practice_subscriptions")
          .update({
            status: "suspended",
            grace_period_ends_at: gracePeriodEnd.toISOString(),
            updated_at: now.toISOString()
          })
          .eq("id", trial.id);

        // Create urgent notification
        await supabaseClient.functions.invoke('handleNotifications', {
          body: {
            user_id: trial.practice_id,
            notification_type: 'subscription_suspended',
            title: '⚠️ Subscription Suspended - Add Payment Method',
            message: `Your trial has ended but no payment method is on file. Add a payment method within 3 days to reactivate your subscription.`,
            action_url: '/profile',
            metadata: {
              subscription_id: trial.id,
              grace_period_ends: gracePeriodEnd.toISOString()
            }
          }
        });

        // Mark reminder as sent
        const { error: reminderError } = await supabaseClient
          .from("trial_payment_reminders")
          .insert({
            practice_id: trial.practice_id,
            subscription_id: trial.id,
            reminder_type: "suspended"
          });
        
        if (reminderError) {
          edgeLogger.error('Error recording suspension reminder', reminderError);
        }

        results.push({ 
          subscription_id: trial.id, 
          status: "suspended", 
          reason: "no_payment_method",
          grace_period_ends: gracePeriodEnd.toISOString() 
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        trials_processed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    edgeLogger.error('Error converting trials', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
