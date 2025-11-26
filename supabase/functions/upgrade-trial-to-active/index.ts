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
    const supabaseClient = createAdminClient();

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Verify the JWT token and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { practiceId: requestedPracticeId } = await req.json();

    // Resolve the practice ID (handle impersonation)
    let practiceId = requestedPracticeId;
    
    // Check if this is an impersonation session
    const { data: impersonation } = await supabaseClient
      .from("impersonation_sessions")
      .select("target_practice_id")
      .eq("admin_id", user.id)
      .eq("is_active", true)
      .single();

    if (impersonation) {
      practiceId = impersonation.target_practice_id;
    }

    if (!practiceId) {
      throw new Error("Practice ID not found");
    }

    edgeLogger.info('[upgrade-trial-to-active] Upgrading trial subscription', { practiceId });

    // Get the subscription
    const { data: subscription, error: subError } = await supabaseClient
      .from("practice_subscriptions")
      .select("*")
      .eq("practice_id", practiceId)
      .single();

    if (subError || !subscription) {
      throw new Error("Subscription not found");
    }

    // CRITICAL: Verify subscription is in trial or suspended status
    if (subscription.status !== "trial" && subscription.status !== "suspended") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Subscription must be in trial or suspended status to enroll" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // CRITICAL: Verify user has accepted terms and authorized payment
    if (!subscription.paid_terms_accepted_at) {
      edgeLogger.error('[upgrade-trial-to-active] Enrollment attempted without consent', { 
        subscriptionId: subscription.id 
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "You must accept the subscription terms and authorize payment before enrolling. Please try again." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    edgeLogger.info('[upgrade-trial-to-active] Terms consent verified', { 
      subscriptionId: subscription.id,
      termsAcceptedAt: subscription.paid_terms_accepted_at 
    });

    // Check for active payment method
    const { data: paymentMethods, error: paymentError } = await supabaseClient
      .from("practice_payment_methods")
      .select("*")
      .eq("practice_id", practiceId)
      .eq("status", "active")
      .order("is_default", { ascending: false })
      .limit(1);

    if (paymentError) {
      edgeLogger.error('[upgrade-trial-to-active] Error fetching payment methods', paymentError);
      throw new Error("Failed to fetch payment methods");
    }

    if (!paymentMethods || paymentMethods.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No active payment method on file. Please add a valid payment method before upgrading." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    edgeLogger.info('[upgrade-trial-to-active] Found active payment method', { 
      paymentMethodId: paymentMethods[0].id 
    });

    edgeLogger.info('[upgrade-trial-to-active] Processing payment', { 
      subscriptionId: subscription.id 
    });

    // Process the payment using existing edge function
    const paymentResponse = await supabaseClient.functions.invoke(
      "process-subscription-payment",
      {
        body: { subscriptionId: subscription.id }
      }
    );

    edgeLogger.info('[upgrade-trial-to-active] Payment response received');
    if (paymentResponse.error) {
      edgeLogger.error('[upgrade-trial-to-active] Payment processing error', paymentResponse.error);
      throw new Error(`Payment failed: ${paymentResponse.error.message}`);
    }

    const paymentResult = paymentResponse.data;
    
    if (!paymentResult?.success) {
      edgeLogger.error('[upgrade-trial-to-active] Payment was not successful', new Error(paymentResult?.error || 'Payment declined'));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: paymentResult?.error ?? "Payment was declined. Please check your payment method and try again." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    edgeLogger.info('[upgrade-trial-to-active] Payment successful', { 
      transactionId: paymentResult.transactionId 
    });

    // Update subscription to active status
    const now = new Date().toISOString();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    const { error: updateError } = await supabaseClient
      .from("practice_subscriptions")
      .update({
        status: "active",
        current_period_start: now,
        current_period_end: periodEnd.toISOString(),
        trial_ends_at: null,
        updated_at: now
      })
      .eq("id", subscription.id);

    if (updateError) {
      edgeLogger.error('[upgrade-trial-to-active] Error updating subscription', updateError);
      throw new Error("Failed to update subscription status");
    }

    edgeLogger.info('[upgrade-trial-to-active] Subscription upgraded successfully', { 
      subscriptionId: subscription.id 
    });

    // Create success notification
    await supabaseClient
      .from("notifications")
      .insert({
        user_id: practiceId,
        title: "Subscription Activated",
        message: "Your VitaLuxePro subscription is now active. Welcome!",
        type: "subscription",
        read: false
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        transactionId: paymentResult.transactionId,
        message: "Subscription successfully upgraded to active"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    edgeLogger.error('[upgrade-trial-to-active] Fatal error', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to upgrade subscription"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
