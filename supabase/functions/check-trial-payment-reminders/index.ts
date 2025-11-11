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
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    console.log('Checking for trial payment reminders...');

    // Get trials ending in 2 days (day 12 reminder for 14-day trial)
    const { data: day12Trials } = await supabaseClient
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
      .gte("trial_ends_at", now.toISOString())
      .lte("trial_ends_at", twoDaysFromNow.toISOString());

    console.log(`Found ${day12Trials?.length || 0} trials ending in ~2 days`);

    // Get trials ending in 1 day (day 13 reminder for 14-day trial)
    const { data: day13Trials } = await supabaseClient
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
      .gte("trial_ends_at", now.toISOString())
      .lte("trial_ends_at", oneDayFromNow.toISOString());

    console.log(`Found ${day13Trials?.length || 0} trials ending in ~1 day`);

    const results = [];

    // Process day 12 reminders (2 days before end of 14-day trial)
    for (const trial of day12Trials || []) {
      const profile = trial.profiles as any;
      
      // Check if reminder already sent
      const { data: existingReminder } = await supabaseClient
        .from("trial_payment_reminders")
        .select("id")
        .eq("subscription_id", trial.id)
        .eq("reminder_type", "day_12")
        .single();

      if (existingReminder) {
        console.log(`Day 12 reminder already sent for subscription ${trial.id}`);
        continue;
      }

      // Check if payment method exists
      const hasPaymentMethod = profile.authorizenet_customer_profile_id != null;

      if (!hasPaymentMethod) {
        console.log(`Sending day 12 reminder to practice ${profile.name}`);

        // Create notification via unified system
        const { error: notifError } = await supabaseClient.functions.invoke('handleNotifications', {
          body: {
            user_id: trial.practice_id,
            notification_type: "subscription_reminder",
            title: "Add Payment Method - Trial Ending Soon",
            message: `Your VitaLuxePro trial ends in 2 days. Please add a payment method to continue your subscription without interruption.`,
            action_url: "/profile",
            metadata: {
              subscription_id: trial.id,
              trial_ends_at: trial.trial_ends_at,
              reminder_day: 12,
              days_remaining: 2
            }
          }
        });

        if (notifError) {
          console.error('Error creating notification:', notifError);
        }

        // Mark reminder as sent
        await supabaseClient
          .from("trial_payment_reminders")
          .insert({
            practice_id: trial.practice_id,
            subscription_id: trial.id,
            reminder_type: "day_12"
          });

        results.push({ subscription_id: trial.id, reminder_type: "day_12", sent: true });
      } else {
        console.log(`Practice ${profile.name} already has payment method`);
        results.push({ subscription_id: trial.id, reminder_type: "day_12", sent: false, reason: "has_payment_method" });
      }
    }

    // Process day 13 reminders (more urgent - 1 day before end of 14-day trial)
    for (const trial of day13Trials || []) {
      const profile = trial.profiles as any;
      
      // Check if reminder already sent
      const { data: existingReminder } = await supabaseClient
        .from("trial_payment_reminders")
        .select("id")
        .eq("subscription_id", trial.id)
        .eq("reminder_type", "day_13")
        .single();

      if (existingReminder) {
        console.log(`Day 13 reminder already sent for subscription ${trial.id}`);
        continue;
      }

      // Check if payment method exists
      const hasPaymentMethod = profile.authorizenet_customer_profile_id != null;

      if (!hasPaymentMethod) {
        console.log(`Sending day 13 (URGENT) reminder to practice ${profile.name}`);

        // Create urgent notification via unified system
        const { error: notifError } = await supabaseClient.functions.invoke('handleNotifications', {
          body: {
            user_id: trial.practice_id,
            notification_type: "subscription_reminder",
            title: "⚠️ URGENT: Add Payment Method - Trial Ends Tomorrow",
            message: `Your VitaLuxePro trial ends in 1 day! Add a payment method now to avoid subscription suspension.`,
            action_url: "/profile",
            metadata: {
              subscription_id: trial.id,
              trial_ends_at: trial.trial_ends_at,
              reminder_day: 13,
              days_remaining: 1,
              urgent: true
            }
          }
        });

        if (notifError) {
          console.error('Error creating notification:', notifError);
        }

        // Mark reminder as sent
        await supabaseClient
          .from("trial_payment_reminders")
          .insert({
            practice_id: trial.practice_id,
            subscription_id: trial.id,
            reminder_type: "day_13"
          });

        results.push({ subscription_id: trial.id, reminder_type: "day_13", sent: true });
      } else {
        console.log(`Practice ${profile.name} already has payment method`);
        results.push({ subscription_id: trial.id, reminder_type: "day_13", sent: false, reason: "has_payment_method" });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        reminders_sent: results.filter(r => r.sent).length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error checking trial reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
