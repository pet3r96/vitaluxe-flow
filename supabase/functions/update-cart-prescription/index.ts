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
      console.error('[update-cart-prescription] Missing Authorization header');
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
      console.error('[update-cart-prescription] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { lineId, prescriptionUrl, prescriptionMethod, customSig, customDosage } = await req.json();

    console.log('[update-cart-prescription] Updating line:', lineId);

    if (!lineId) {
      return new Response(
        JSON.stringify({ error: 'lineId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updateData: any = {};
    if (prescriptionUrl !== undefined) updateData.prescription_url = prescriptionUrl;
    if (prescriptionMethod !== undefined) updateData.prescription_method = prescriptionMethod;
    if (customSig !== undefined) updateData.custom_sig = customSig;
    if (customDosage !== undefined) updateData.custom_dosage = customDosage;

    const { error: updateError } = await supabase
      .from("cart_lines")
      .update(updateData)
      .eq("id", lineId);

    if (updateError) {
      console.error('[update-cart-prescription] Update error:', updateError);
      throw updateError;
    }

    console.log('[update-cart-prescription] Success');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[update-cart-prescription] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
