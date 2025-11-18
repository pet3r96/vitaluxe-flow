import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAuthClient } from '../_shared/supabaseAdmin.ts';
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
      edgeLogger.error('get-cart missing auth header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createAuthClient(authHeader);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      edgeLogger.error('get-cart auth error', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { cartOwnerId, productFields, includePharmacy, includeProvider, hydratePatients } = await req.json();

    edgeLogger.info('Fetching cart');

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
      edgeLogger.error('get-cart fetch error', cartError);
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
      edgeLogger.error('get-cart lines error', linesError);
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

    edgeLogger.info('get-cart success', { lineCount: lines.length });

    return new Response(
      JSON.stringify({ id: cartData.id, lines }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    edgeLogger.error('get-cart error', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
