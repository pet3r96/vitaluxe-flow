import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateRequestSize } from '../_shared/requestSizeValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // PHASE 3 SECURITY: Request size validation
  const sizeValidation = validateRequestSize(req, 'update-shipping-speed', corsHeaders);
  if (sizeValidation) return sizeValidation;

  const startTime = Date.now();
  const ipAddress = getClientIP(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      edgeLogger.error('update-shipping-speed missing auth header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createAuthClient(authHeader);
    const supabaseAdmin = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      edgeLogger.error('update-shipping-speed auth error', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 3: Rate limiting (30 requests/hour)
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      ipAddress,
      'update-shipping-speed',
      { maxRequests: 30, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { userId: user.id, function: 'update-shipping-speed' });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { lineIds, shipping_speed } = await req.json();

    // Normalize to unique UUIDs
    const uniqueLineIds = [...new Set(lineIds || [])].filter((id: any) => typeof id === 'string' && id.length > 0);

    edgeLogger.info('update-shipping-speed request', {
      originalCount: lineIds?.length || 0,
      uniqueCount: uniqueLineIds.length,
      shipping_speed
    });

    if (uniqueLineIds.length === 0) {
      edgeLogger.info('update-shipping-speed no valid line IDs (idempotent)');
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: 'No lines to update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!shipping_speed) {
      return new Response(
        JSON.stringify({ error: 'shipping_speed required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 3 SECURITY: ID validation - verify user owns the cart lines
    const { data: cartLines, error: fetchError } = await supabaseAdmin
      .from('cart_lines')
      .select('cart_id')
      .in('id', uniqueLineIds)
      .limit(1)
      .single();

    if (fetchError || !cartLines) {
      edgeLogger.error('Cart lines not found', fetchError, { userId: user.id, lineIds: uniqueLineIds });
      return new Response(
        JSON.stringify({ error: 'Cart lines not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate cart belongs to user
    const { data: cart, error: cartError } = await supabaseAdmin
      .from('cart')
      .select('doctor_id')
      .eq('id', cartLines.cart_id)
      .single();

    if (cartError || !cart || cart.doctor_id !== user.id) {
      edgeLogger.error('ID validation failed - cart access denied', undefined, { 
        userId: user.id, 
        cartId: cartLines.cart_id 
      });
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update shipping speed ONLY for lines where it differs (idempotent)
    const { data: updatedLines, error: updateError } = await supabase
      .from("cart_lines")
      .update({ shipping_speed })
      .in("id", uniqueLineIds)
      .neq("shipping_speed", shipping_speed)
      .select("id");

    if (updateError) {
      edgeLogger.error('update-shipping-speed update error', updateError);
      throw updateError;
    }

    const updatedCount = updatedLines?.length || 0;
    edgeLogger.info('update-shipping-speed success', {
      uniqueLineIds: uniqueLineIds.length,
      updatedCount,
      shipping_speed
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        lineIds: uniqueLineIds, 
        updated: updatedCount,
        shipping_speed 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    edgeLogger.error('update-shipping-speed error', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
