import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminClient, createAuthClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use auth client for auth verification
    const supabaseAuth = createAuthClient(req.headers.get('Authorization'));

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }
    
    // Create admin client for NPI checks (bypasses RLS)
    const supabase = createAdminClient();

    const { practice_id, product_id } = await req.json();

    if (!practice_id || !product_id) {
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          error: 'Missing required parameters: practice_id and product_id' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    edgeLogger.info('[validate-rx-order] Validating RX order', { practiceId: practice_id, productId: product_id, userId: user.id });

    // Check if product requires prescription
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('requires_prescription, name')
      .eq('id', product_id)
      .single();

    if (productError) {
      edgeLogger.error('[validate-rx-order] Error fetching product', productError);
      throw new Error('Product not found');
    }

    // If product doesn't require prescription, allow order
    if (!product.requires_prescription) {
      edgeLogger.info('[validate-rx-order] Non-RX product, allowing order');
      return new Response(
        JSON.stringify({ allowed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For RX products, verify practice has at least one active provider with NPI
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('id, user_id, profiles!providers_user_id_fkey(npi)')
      .eq('practice_id', practice_id)
      .eq('active', true);

    if (providersError) {
      edgeLogger.error('[validate-rx-order] Error fetching providers', providersError);
      throw new Error('Error checking provider credentials');
    }

    const providersWithNpi = providers?.filter(p => {
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      return profile?.npi;
    }) || [];

    edgeLogger.info('[validate-rx-order] Provider check', {
      practiceId: practice_id,
      totalProviders: providers?.length || 0,
      providersWithNpi: providersWithNpi.length
    });

    if (providersWithNpi.length === 0) {
      edgeLogger.info('[validate-rx-order] No providers with NPI found, blocking RX order');
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          error: 'Prescription products require a provider with a valid NPI. Please add a provider with NPI to your practice.',
          requires_npi: true
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    edgeLogger.info('[validate-rx-order] RX order validated successfully');
    return new Response(
      JSON.stringify({ allowed: true }),
      { headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Function-Version': '2.0-service-role'
      } }
    );

  } catch (error) {
    edgeLogger.error('[validate-rx-order] Error', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        allowed: false, 
        error: errorMessage 
      }),
      { 
        status: errorMessage === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
