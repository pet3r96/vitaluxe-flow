import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMMISSION_RATE = 0.20; // 20% commission

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { subscriptionId, practiceId } = await req.json();

    // Get practice and linked topline rep
    const { data: practice } = await supabaseClient
      .from("profiles")
      .select("id, linked_topline_id")
      .eq("id", practiceId)
      .single();

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

    const commissionAmount = payment.amount * COMMISSION_RATE;

    // Record commission
    const { error: commissionError } = await supabaseClient
      .from("rep_subscription_commissions")
      .insert({
        representative_id: rep.id,
        practice_id: practiceId,
        subscription_id: subscriptionId,
        payment_id: payment.id,
        commission_amount: commissionAmount,
        commission_date: new Date().toISOString()
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
