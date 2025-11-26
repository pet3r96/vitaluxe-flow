import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
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
    // Verify cron secret for security
    const cronSecret = Deno.env.get('CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');
    
    if (!cronSecret || requestSecret !== cronSecret) {
      const { edgeLogger } = await import("../_shared/logger.ts");
      edgeLogger.error('Unauthorized trial conversion attempt', { hasSecret: !!requestSecret });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createAdminClient();

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

    // CRITICAL: NEVER auto-bill when trial ends - always suspend and require manual enrollment
    for (const trial of expiredTrials || []) {
      const profile = trial.profiles as any;

      edgeLogger.info('Trial expired - suspending for manual enrollment', { 
        practiceName: profile.name, 
        subscriptionId: trial.id 
      });

      // ALWAYS suspend - regardless of payment method
      // User MUST manually click "Enroll in VitaLuxe Pro" to authorize billing
      const gracePeriodEnd = new Date(now);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // 7-day grace period to enroll

      await supabaseClient
        .from("practice_subscriptions")
        .update({
          status: "suspended",
          grace_period_ends_at: gracePeriodEnd.toISOString(),
          updated_at: now.toISOString()
        })
        .eq("id", trial.id);

      // Notify user to MANUALLY enroll if they want to continue
      await supabaseClient.functions.invoke('handleNotifications', {
        body: {
          user_id: trial.practice_id,
          notification_type: 'trial_ended_action_required',
          title: '⚠️ Trial Ended - Manual Enrollment Required',
          message: `Your 14-day trial has ended. To continue using VitaLuxePro, please go to your Profile → Subscription and click "Enroll in VitaLuxe Pro" to activate your subscription. You have 7 days to enroll before your account is deactivated.`,
          action_url: '/profile',
          metadata: {
            subscription_id: trial.id,
            grace_period_ends: gracePeriodEnd.toISOString()
          }
        }
      });

      results.push({ 
        subscription_id: trial.id, 
        status: "suspended", 
        reason: "trial_ended_requires_manual_enrollment",
        grace_period_ends: gracePeriodEnd.toISOString(),
        message: "Trial ended - user must manually enroll to activate subscription"
      });
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
