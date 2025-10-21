import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { validateCalculateShippingRequest } from '../_shared/requestValidators.ts';
import { handleError, createErrorResponse } from '../_shared/errorHandler.ts';

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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    }
  );

  try {
    // Parse request body
    let requestData: CalculateShippingRequest;
    try {
      requestData = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return createErrorResponse('Invalid JSON in request body', 400, null, undefined, corsHeaders);
    }

    // Validate input
    const validation = validateCalculateShippingRequest(requestData);
    if (!validation.valid) {
      console.error('Shipping calculation validation failed:', validation.errors);
      return createErrorResponse(
        'Invalid shipping calculation parameters',
        400,
        null,
        validation.errors,
        corsHeaders
      );
    }

    const { pharmacy_id, shipping_speed } = requestData;

    console.info(`Calculating shipping for pharmacy ${pharmacy_id} with speed ${shipping_speed}`);

    // Query pharmacy_shipping_rates
    const { data, error } = await supabase
      .from('pharmacy_shipping_rates')
      .select('rate')
      .eq('pharmacy_id', pharmacy_id)
      .eq('shipping_speed', shipping_speed)
      .maybeSingle();

    if (error) {
      console.error("Database error fetching shipping rate:", error.message);
      return handleError(
        supabase,
        error,
        'calculate-shipping',
        'database',
        corsHeaders,
        { pharmacy_id, shipping_speed }
      );
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
      JSON.stringify({ 
        success: true,
        shipping_cost,
        pharmacy_id,
        shipping_speed
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Shipping calculation error:", error);
    return handleError(
      supabase,
      error,
      'calculate-shipping',
      'internal',
      corsHeaders
    );
  }
});
