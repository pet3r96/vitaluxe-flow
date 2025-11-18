import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { cacheFetch } from "../_shared/cache.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { errorResponse } from '../_shared/responses.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401);
    }

    const supabase = createAuthClient(authHeader);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return errorResponse('Unauthorized', 401);
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
    return errorResponse(errorMessage, 500);
  }
});
