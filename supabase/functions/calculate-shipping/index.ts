import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalculateShippingRequest {
  pharmacy_id: string;
  shipping_speed: 'ground' | '2day' | 'overnight';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { pharmacy_id, shipping_speed } = await req.json() as CalculateShippingRequest;

    console.info(`Calculating shipping for pharmacy ${pharmacy_id} with speed ${shipping_speed}`);

    // Query pharmacy_shipping_rates
    const { data, error } = await supabase
      .from('pharmacy_shipping_rates')
      .select('rate')
      .eq('pharmacy_id', pharmacy_id)
      .eq('shipping_speed', shipping_speed)
      .maybeSingle();

    if (error) {
      console.error("Error fetching shipping rate:", error);
    }

    // Default fallback rates if pharmacy hasn't configured
    const defaultRates = {
      ground: 9.99,
      '2day': 19.99,
      overnight: 29.99
    };

    const shipping_cost = data?.rate ?? defaultRates[shipping_speed] ?? 9.99;

    console.info(`Shipping cost calculated: $${shipping_cost}`);

    return new Response(
      JSON.stringify({ shipping_cost }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in calculate-shipping:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
