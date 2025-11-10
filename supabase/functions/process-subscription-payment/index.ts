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

    const { subscriptionId } = await req.json();

    const { data: subscription, error: subError } = await supabaseClient
      .from("practice_subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .single();

    if (subError || !subscription) {
      throw new Error("Subscription not found");
    }

    // Find active payment method for practice
    console.log("[process-subscription-payment] Resolving payment method for practice:", subscription.practice_id);
    const { data: paymentMethods, error: paymentMethodError } = await supabaseClient
      .from("practice_payment_methods")
      .select("*")
      .eq("practice_id", subscription.practice_id)
      .eq("status", "active")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (paymentMethodError) {
      console.error("[process-subscription-payment] Error fetching payment methods:", paymentMethodError);
      throw new Error("Failed to fetch payment methods");
    }

    if (!paymentMethods || paymentMethods.length === 0) {
      console.warn("[process-subscription-payment] No active payment method found for practice:", subscription.practice_id);
      return new Response(
        JSON.stringify({
          success: false,
          error: "No active payment method on file. Please add a valid payment method before upgrading."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const method = paymentMethods[0] as any;
    console.log("[process-subscription-payment] Using payment method:", method.id);
    const last4: string = (method.last4 || method.card_last_four || "").toString();

    // Simulate charge outcome based on test card digits
    let chargeSuccess = true;
    if (last4.endsWith("1111")) chargeSuccess = false;
    else if (last4.endsWith("0000")) chargeSuccess = true;
    else chargeSuccess = Math.random() < 0.9;

    const transactionId = `sim_${Date.now()}`;

    // Record payment attempt
    const { error: paymentError } = await supabaseClient
      .from("subscription_payments")
      .insert({
        subscription_id: subscription.id,
        practice_id: subscription.practice_id,
        amount: subscription.monthly_price || 99.99,
        payment_date: new Date().toISOString(),
        status: chargeSuccess ? "completed" : "failed",
        transaction_id: transactionId,
        payment_method: "credit_card"
      });

    if (paymentError) {
      console.error("[process-subscription-payment] Failed to record payment:", paymentError);
      throw paymentError;
    }

    if (chargeSuccess) {
      // Calculate rep commissions (function handles no-rep case)
      await supabaseClient.functions.invoke("calculate-rep-commissions", {
        body: { subscriptionId: subscription.id, practiceId: subscription.practice_id }
      });
    }

    const chargeResult = { success: chargeSuccess, transactionId };

    return new Response(
      JSON.stringify({ success: chargeResult?.success, transactionId: chargeResult?.transactionId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Subscription payment error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
