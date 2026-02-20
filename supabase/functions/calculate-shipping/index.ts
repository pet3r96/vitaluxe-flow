import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { validateCalculateShippingRequest } from '../_shared/requestValidators.ts';
import { handleError, createErrorResponse } from '../_shared/errorHandler.ts';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalculateShippingRequest {
  pharmacy_id: string;
  shipping_speed: 'overnight' | '2day' | 'priority' | 'first_class' | 'ground';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createAuthClient(req.headers.get("Authorization"));

  try {
    // Parse request body
    let requestData: CalculateShippingRequest;
    try {
      requestData = await req.json();
    } catch (parseError) {
      edgeLogger.error('Failed to parse shipping calculation request', parseError);
      return createErrorResponse('Invalid JSON in request body', 400, null, undefined, corsHeaders);
    }

    // Validate input
    const validation = validateCalculateShippingRequest(requestData);
    if (!validation.valid) {
      edgeLogger.error('Shipping calculation validation failed', { errors: validation.errors });
      return createErrorResponse(
        'Invalid shipping calculation parameters',
        400,
        null,
        validation.errors,
        corsHeaders
      );
    }

    const { pharmacy_id, shipping_speed } = requestData;

    edgeLogger.info('Calculating shipping cost', { shipping_speed });

    // Query pharmacy_shipping_rates
    const { data, error } = await supabase
      .from('pharmacy_shipping_rates')
      .select('rate')
      .eq('pharmacy_id', pharmacy_id)
      .eq('shipping_speed', shipping_speed)
      .maybeSingle();

    if (error) {
      edgeLogger.error('Database error fetching shipping rate', error);
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

    edgeLogger.info('Shipping cost calculated', { shipping_cost });

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
    edgeLogger.error('Shipping calculation error', error);
    return handleError(
      supabase,
      error,
      'calculate-shipping',
      'internal',
      corsHeaders
    );
  }
});
