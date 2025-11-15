import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[add-to-cart] Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[add-to-cart] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      cartOwnerId, 
      productId, 
      quantity = 1, 
      patientId, 
      patientName, 
      destinationState,
      providerId 
    } = await req.json();

    if (!cartOwnerId || !productId || !patientName || !destinationState) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[add-to-cart] Adding item:', { cartOwnerId, productId, quantity, patientName });

    // Validate product exists and is active
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, active")
      .eq("id", productId)
      .single();

    if (productError || !product || !product.active) {
      return new Response(
        JSON.stringify({ error: 'Product not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find or create cart
    let { data: cart } = await supabase
      .from("cart")
      .select("id")
      .eq("doctor_id", cartOwnerId)
      .maybeSingle();

    if (!cart) {
      const { data: newCart, error: cartError } = await supabase
        .from("cart")
        .insert({ doctor_id: cartOwnerId })
        .select("id")
        .single();

      if (cartError) throw cartError;
      cart = newCart;
    }

    // Insert cart line with 24h expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { data: cartLine, error: insertError } = await supabase
      .from("cart_lines")
      .insert({
        cart_id: cart.id,
        product_id: productId,
        quantity,
        patient_id: patientId,
        patient_name: patientName,
        destination_state: destinationState,
        provider_id: providerId,
        expires_at: expiresAt.toISOString()
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    console.log('[add-to-cart] Success:', cartLine.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        cartLineId: cartLine.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[add-to-cart] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
