import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const today = new Date().toISOString().split('T')[0];
    
    // Get active subscriptions due for renewal
    const { data: subscriptions } = await supabaseClient
      .from("practice_subscriptions")
      .select(`
        *,
        profiles!practice_subscriptions_practice_id_fkey (
          id,
          name,
          email,
          authorizenet_customer_profile_id
        )
      `)
      .eq("status", "active")
      .lte("current_period_end", today);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions due for renewal" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const subscription of subscriptions) {
      try {
        const profile = subscription.profiles as any;
        const hasPaymentMethod = profile?.authorizenet_customer_profile_id != null;

        console.log(`Processing renewal for subscription ${subscription.id}, has payment: ${hasPaymentMethod}`);

        // Check if payment method exists BEFORE attempting charge
        if (!hasPaymentMethod) {
          console.log(`No payment method for subscription ${subscription.id}, suspending`);
          
          const gracePeriodEnd = new Date();
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3); // 3-day grace period

          await supabaseClient
            .from("practice_subscriptions")
            .update({
              status: "suspended",
              grace_period_ends_at: gracePeriodEnd.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", subscription.id);

          // Create urgent notification
          await supabaseClient.functions.invoke('handleNotifications', {
            body: {
              user_id: subscription.practice_id,
              notification_type: 'subscription_suspended',
              title: '⚠️ Subscription Suspended - Add Payment Method',
              message: `Your subscription renewal failed due to missing payment method. Add one within 3 days to avoid service interruption.`,
              action_url: '/profile',
              metadata: {
                subscription_id: subscription.id,
                grace_period_ends: gracePeriodEnd.toISOString()
              }
            }
          });

          results.push({ 
            subscriptionId: subscription.id, 
            status: "suspended", 
            reason: "no_payment_method",
            grace_period_ends: gracePeriodEnd.toISOString() 
          });
          continue;
        }

        // Attempt to charge payment
        const paymentResponse = await supabaseClient.functions.invoke(
          "process-subscription-payment",
          { body: { subscriptionId: subscription.id } }
        );

        if (paymentResponse.data?.success) {
          // Payment successful - renew for 30 days
          const newPeriodEnd = new Date();
          newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);

          await supabaseClient
            .from("practice_subscriptions")
            .update({
              current_period_start: new Date().toISOString(),
              current_period_end: newPeriodEnd.toISOString(),
              last_payment_attempt_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", subscription.id);

          // Create success notification
          await supabaseClient.functions.invoke('handleNotifications', {
            body: {
              user_id: subscription.practice_id,
              notification_type: 'subscription_renewed',
              title: '✅ Subscription Renewed',
              message: `Your VitaLuxePro subscription has been successfully renewed. Next billing date: ${newPeriodEnd.toLocaleDateString()}.`,
              metadata: {
                subscription_id: subscription.id,
                amount_charged: 500.00,
                next_billing_date: newPeriodEnd.toISOString()
              }
            }
          });

          results.push({ 
            subscriptionId: subscription.id, 
            status: "renewed",
            next_billing_date: newPeriodEnd.toISOString() 
          });
        } else {
          // Payment failed - check if this is first attempt or retry
          const lastAttempt = subscription.last_payment_attempt_at 
            ? new Date(subscription.last_payment_attempt_at) 
            : null;
          const hoursSinceLastAttempt = lastAttempt 
            ? (new Date().getTime() - lastAttempt.getTime()) / (1000 * 60 * 60)
            : null;

          if (!lastAttempt || hoursSinceLastAttempt! > 24) {
            // First attempt or 24 hours since last attempt - schedule retry
            console.log(`First payment attempt failed for ${subscription.id}, will retry in 24 hours`);
            
            await supabaseClient
              .from("practice_subscriptions")
              .update({
                last_payment_attempt_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq("id", subscription.id);

            // Create notification about failed payment
            await supabaseClient.functions.invoke('handleNotifications', {
              body: {
                user_id: subscription.practice_id,
                notification_type: 'payment_failed',
                title: 'Payment Failed - Will Retry',
                message: `Your subscription payment failed. We'll retry in 24 hours. Please check your payment method.`,
                action_url: '/profile',
                metadata: {
                  subscription_id: subscription.id,
                  retry_scheduled: true
                }
              }
            });

            results.push({ 
              subscriptionId: subscription.id, 
              status: "payment_failed_retry_scheduled" 
            });
          } else {
            // Second attempt failed - suspend with grace period
            console.log(`Second payment attempt failed for ${subscription.id}, suspending`);
            
            const gracePeriodEnd = new Date();
            gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);

            await supabaseClient
              .from("practice_subscriptions")
              .update({
                status: "suspended",
                grace_period_ends_at: gracePeriodEnd.toISOString(),
                last_payment_attempt_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq("id", subscription.id);

            // Create urgent notification
            await supabaseClient.functions.invoke('handleNotifications', {
              body: {
                user_id: subscription.practice_id,
                notification_type: 'subscription_suspended',
                title: '⚠️ Subscription Suspended - Payment Failed',
                message: `Multiple payment attempts failed. Update your payment method within 3 days to avoid service interruption.`,
                action_url: '/profile',
                metadata: {
                  subscription_id: subscription.id,
                  grace_period_ends: gracePeriodEnd.toISOString()
                }
              }
            });

            results.push({ 
              subscriptionId: subscription.id, 
              status: "suspended",
              reason: "payment_failed_multiple_attempts",
              grace_period_ends: gracePeriodEnd.toISOString() 
            });
          }
        }
      } catch (error: any) {
        console.error(`Renewal error for ${subscription.id}:`, error);
        results.push({ subscriptionId: subscription.id, status: "error", error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Subscription renewal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
