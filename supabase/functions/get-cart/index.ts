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
      console.error('[get-cart] Missing Authorization header');
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
      console.error('[get-cart] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { cartOwnerId, productFields, includePharmacy, includeProvider, hydratePatients } = await req.json();

    console.log('[get-cart] Fetching cart for owner:', cartOwnerId);

    if (!cartOwnerId) {
      return new Response(
        JSON.stringify({ id: '', lines: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get cart
    const { data: cartData, error: cartError } = await supabase
      .from("cart")
      .select("id")
      .eq("doctor_id", cartOwnerId)
      .maybeSingle();

    if (cartError) {
      console.error('[get-cart] Cart error:', cartError);
      throw cartError;
    }

    if (!cartData) {
      return new Response(
        JSON.stringify({ id: '', lines: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build select query
    const fields = productFields || "name, dosage, sig, image_url, base_price, requires_prescription";
    let selectFields = `*, product:products(${fields})`;

    if (includePharmacy) {
      selectFields += `,pharmacy:pharmacies(name)`;
    }

    if (includeProvider) {
      selectFields += `,provider:providers(id, user_id, profiles!providers_user_id_fkey(name, npi, dea))`;
    }

    // Get cart lines
    const { data: linesRaw, error: linesError } = await supabase
      .from("cart_lines")
      .select(selectFields)
      .eq("cart_id", cartData.id)
      .gte("expires_at", new Date().toISOString());

    if (linesError) {
      console.error('[get-cart] Lines error:', linesError);
      throw linesError;
    }

    const lines = (linesRaw || []) as any[];

    // Hydrate patients if requested
    if (hydratePatients && lines.length > 0) {
      const patientIds = Array.from(
        new Set(lines.map((l) => l.patient_id).filter(Boolean))
      );

      if (patientIds.length > 0) {
        const { data: patients, error: patientsError } = await supabase
          .from("patient_accounts")
          .select("id, name, first_name, last_name, address_street, address_city, address_state, address_zip, address_formatted")
          .in("id", patientIds);

        if (!patientsError && patients) {
          const patientMap = new Map(patients.map((p: any) => [p.id, p]));
          for (const line of lines) {
            if (line.patient_id) {
              const patient = patientMap.get(line.patient_id) || null;
              line.patient = patient;
              line.patient_name = patient?.name || line.patient_name;
            }
          }
        }
      }
    }

    console.log('[get-cart] Success - returning', lines.length, 'lines');

    return new Response(
      JSON.stringify({ id: cartData.id, lines }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[get-cart] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
