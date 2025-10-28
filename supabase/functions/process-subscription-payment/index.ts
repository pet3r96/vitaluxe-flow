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
      .select("*, profiles!practice_id(*)")
      .eq("id", subscriptionId)
      .single();

    if (subError || !subscription) {
      throw new Error("Subscription not found");
    }

    const practice = subscription.profiles;
    if (!practice.authorizenet_customer_profile_id) {
      throw new Error("No payment method on file");
    }

    // Charge payment via Authorize.net
    const chargeResponse = await supabaseClient.functions.invoke(
      "authorizenet-charge-payment",
      {
        body: {
          customerProfileId: practice.authorizenet_customer_profile_id,
          amount: subscription.monthly_price || 99.00,
          description: `VitaLuxePro Subscription - ${new Date().toLocaleDateString()}`
        }
      }
    );

    const chargeResult = chargeResponse.data;
    if (chargeResponse.error) throw chargeResponse.error;

    // Record payment
    const { error: paymentError } = await supabaseClient
      .from("subscription_payments")
      .insert({
        subscription_id: subscription.id,
        practice_id: subscription.practice_id,
        amount: subscription.monthly_price || 99.00,
        payment_date: new Date().toISOString(),
        status: chargeResult?.success ? "completed" : "failed",
        transaction_id: chargeResult?.transactionId,
        payment_method: "credit_card"
      });

    if (paymentError) throw paymentError;

    if (chargeResult?.success) {
      // Calculate rep commission if practice has a rep
      if (practice.linked_topline_id) {
        await supabaseClient.functions.invoke("calculate-rep-commissions", {
          body: { subscriptionId: subscription.id, practiceId: subscription.practice_id }
        });
      }
    }

    return new Response(
      JSON.stringify({ success: chargeResult?.success, transactionId: chargeResult?.transactionId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Subscription payment error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
