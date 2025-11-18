import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { cacheFetch } from "../_shared/cache.ts";

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
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { effectiveUserId } = await req.json();
    
    if (!effectiveUserId) {
      throw new Error('effectiveUserId is required');
    }

    const cacheKey = `product_visibility:${effectiveUserId}`;
    
    const visibleProducts = await cacheFetch(
      cacheKey,
      async () => {
        console.log('Cache miss - fetching visible products from RPC');
        const { data, error } = await supabase.rpc(
          'get_visible_products_for_effective_user',
          { p_effective_user_id: effectiveUserId }
        );

        if (error) throw error;
        return data || [];
      },
      900 // 15 minutes TTL
    );

    return new Response(
      JSON.stringify({ visibleProducts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-visible-products:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
