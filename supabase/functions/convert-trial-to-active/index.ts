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

    const now = new Date();
    console.log('Checking for expired trials to convert...');

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

    console.log(`Found ${expiredTrials?.length || 0} expired trials`);

    const results = [];

    for (const trial of expiredTrials || []) {
      const profile = trial.profiles as any;
      const hasPaymentMethod = profile.authorizenet_customer_profile_id != null;

      console.log(`Processing expired trial for practice ${profile.name}, has payment: ${hasPaymentMethod}`);

      if (hasPaymentMethod) {
        // Attempt to charge first payment
        try {
          console.log(`Attempting to charge first payment for subscription ${trial.id}`);
          
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
            await supabaseClient
              .from("notifications")
              .insert({
                user_id: trial.practice_id,
                notification_type: "subscription_activated",
                severity: "info",
                title: "✅ VitaLuxePro Subscription Activated",
                message: `Your trial has ended and your subscription is now active. Your next billing date is ${nextPeriodEnd.toLocaleDateString()}.`,
                metadata: {
                  subscription_id: trial.id,
                  billing_amount: 500.00,
                  next_billing_date: nextPeriodEnd.toISOString()
                }
              });

            results.push({ 
              subscription_id: trial.id, 
              status: "activated", 
              next_billing_date: nextPeriodEnd.toISOString() 
            });
            
            console.log(`Successfully activated subscription ${trial.id}`);
          } else {
            throw new Error(paymentResponse.data?.error || "Payment failed");
          }
        } catch (error: any) {
          console.error(`Payment failed for subscription ${trial.id}:`, error);
          
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
          await supabaseClient
            .from("notifications")
            .insert({
              user_id: trial.practice_id,
              notification_type: "payment_failed",
              severity: "high",
              title: "⚠️ Payment Failed - Action Required",
              message: `We couldn't process your payment. Please update your payment method within 3 days to avoid service interruption.`,
              action_url: "/profile",
              metadata: {
                subscription_id: trial.id,
                grace_period_ends: gracePeriodEnd.toISOString(),
                error: error.message
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
        console.log(`No payment method for subscription ${trial.id}, suspending`);
        
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
        await supabaseClient
          .from("notifications")
          .insert({
            user_id: trial.practice_id,
            notification_type: "subscription_suspended",
            severity: "high",
            title: "⚠️ Subscription Suspended - Add Payment Method",
            message: `Your trial has ended but no payment method is on file. Add a payment method within 3 days to reactivate your subscription.`,
            action_url: "/profile",
            metadata: {
              subscription_id: trial.id,
              grace_period_ends: gracePeriodEnd.toISOString()
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
          console.error('Error recording suspension reminder:', reminderError);
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
    console.error("Error converting trials:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
