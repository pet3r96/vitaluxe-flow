import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

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

    const { subscriptionId, practiceId } = await req.json();

    // Get subscription with commission percentage and status
    const { data: subscription, error: subError } = await supabaseClient
      .from("practice_subscriptions")
      .select("*, profiles!practice_id(id, linked_topline_id)")
      .eq("id", subscriptionId)
      .single();

    if (subError || !subscription) {
      throw new Error("Subscription not found");
    }

    // Verify practice is past trial period
    if (subscription.status === 'trial') {
      return new Response(
        JSON.stringify({ message: "Cannot calculate commission during trial period" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const practice = subscription.profiles;
    
    if (!practice?.linked_topline_id) {
      return new Response(
        JSON.stringify({ message: "No representative assigned to this practice" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get rep ID from user_id
    const { data: rep } = await supabaseClient
      .from("reps")
      .select("id")
      .eq("user_id", practice.linked_topline_id)
      .single();

    if (!rep) {
      return new Response(
        JSON.stringify({ message: "Representative not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get latest completed payment
    const { data: payment } = await supabaseClient
      .from("subscription_payments")
      .select("*")
      .eq("subscription_id", subscriptionId)
      .eq("status", "completed")
      .order("payment_date", { ascending: false })
      .limit(1)
      .single();

    if (!payment) {
      throw new Error("No completed payment found");
    }

    // Use custom commission rate or default to 20%
    const commissionRate = (subscription.rep_commission_percentage || 20) / 100;
    const commissionAmount = payment.amount * commissionRate;

    // Record commission with pending payment status
    const { error: commissionError } = await supabaseClient
      .from("rep_subscription_commissions")
      .insert({
        rep_id: rep.id,
        practice_id: practiceId,
        subscription_id: subscriptionId,
        payment_id: payment.id,
        commission_amount: commissionAmount,
        commission_date: new Date().toISOString(),
        payment_status: 'pending'
      });

    if (commissionError) throw commissionError;

    console.log(`Commission recorded: $${commissionAmount} for rep ${rep.id}`);

    return new Response(
      JSON.stringify({ success: true, commissionAmount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Commission calculation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
