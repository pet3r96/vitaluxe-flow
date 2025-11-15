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
      console.error('[clear-cart] Missing Authorization header');
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
      console.error('[clear-cart] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { cartOwnerId } = await req.json();

    console.log('[clear-cart] Clearing cart for owner:', cartOwnerId);

    if (!cartOwnerId) {
      return new Response(
        JSON.stringify({ error: 'cartOwnerId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get cart
    const { data: cart } = await supabase
      .from('cart')
      .select('id')
      .eq('doctor_id', cartOwnerId)
      .maybeSingle();

    if (cart) {
      const { error: deleteError } = await supabase
        .from('cart_lines')
        .delete()
        .eq('cart_id', cart.id);

      if (deleteError) {
        console.error('[clear-cart] Delete error:', deleteError);
        throw deleteError;
      }

      console.log('[clear-cart] Success - cleared cart', cart.id);
    } else {
      console.log('[clear-cart] No cart found for owner', cartOwnerId);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[clear-cart] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
