import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAuthClient } from "../_shared/supabaseAdmin.ts";
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

    const supabase = createAuthClient(authHeader);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const cacheKey = 'top_products:global';
    
    const topProducts = await cacheFetch(
      cacheKey,
      async () => {
        console.log('Cache miss - fetching top products from materialized view');
        const { data, error } = await supabase
          .from('mv_top_products')
          .select('id, name, total_sales, total_revenue')
          .order('total_revenue', { ascending: false })
          .limit(5);

        if (error) throw error;
        return data || [];
      },
      300 // 5 minutes TTL
    );

    return new Response(
      JSON.stringify({ topProducts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-top-products:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
