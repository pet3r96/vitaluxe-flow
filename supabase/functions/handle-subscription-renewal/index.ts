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
    
    const { data: subscriptions } = await supabaseClient
      .from("practice_subscriptions")
      .select("*")
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
        const paymentResponse = await supabaseClient.functions.invoke(
          "process-subscription-payment",
          { body: { subscriptionId: subscription.id } }
        );

        if (paymentResponse.data?.success) {
          const newPeriodEnd = new Date();
          newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);

          await supabaseClient
            .from("practice_subscriptions")
            .update({
              current_period_start: new Date().toISOString(),
              current_period_end: newPeriodEnd.toISOString()
            })
            .eq("id", subscription.id);

          results.push({ subscriptionId: subscription.id, status: "renewed" });
        } else {
          results.push({ subscriptionId: subscription.id, status: "payment_failed" });
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
