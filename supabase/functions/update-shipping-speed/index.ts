import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { edgeLogger } from '../_shared/logger.ts';

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
      edgeLogger.error('update-shipping-speed missing auth header');
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
      edgeLogger.error('update-shipping-speed auth error', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
