import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    edgeLogger.info('Starting cleanup of expired cart lines');

    // Call the cleanup function
    const { data, error } = await supabase.rpc('cleanup_expired_cart_lines');

    if (error) {
      edgeLogger.error('Error cleaning up expired cart lines', error);
      throw error;
    }

    edgeLogger.info('Successfully cleaned up expired cart lines', { count: data });

    return new Response(
      JSON.stringify({
        success: true,
        cleaned_count: data,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    edgeLogger.error('Cart line cleanup failed', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
