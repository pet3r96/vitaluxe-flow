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
      console.error('[update-cart-address] Missing Authorization header');
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
      console.error('[update-cart-address] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { lineIds, address, assignedPharmacyId } = await req.json();

    console.log('[update-cart-address] Updating address for lines:', lineIds);

    if (!lineIds || !Array.isArray(lineIds) || lineIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'lineIds array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'address object required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updateData: any = {};
    if (address.street !== undefined) updateData.patient_address_street = address.street;
    if (address.city !== undefined) updateData.patient_address_city = address.city;
    if (address.state !== undefined) {
      updateData.patient_address_state = address.state;
      updateData.destination_state = address.state; // Also update destination_state for routing
    }
    if (address.zip !== undefined) updateData.patient_address_zip = address.zip;
    if (address.formatted !== undefined) {
      updateData.patient_address_formatted = address.formatted;
      updateData.patient_address = address.formatted; // Also update legacy field
    }
    if (address.validated !== undefined) updateData.patient_address_validated = address.validated;
    if (address.validationSource !== undefined) updateData.patient_address_validation_source = address.validationSource;
    if (assignedPharmacyId !== undefined) updateData.assigned_pharmacy_id = assignedPharmacyId;

    const { error: updateError } = await supabase
      .from("cart_lines")
      .update(updateData)
      .in("id", lineIds);

    if (updateError) {
      console.error('[update-cart-address] Update error:', updateError);
      throw updateError;
    }

    console.log('[update-cart-address] Success');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[update-cart-address] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
