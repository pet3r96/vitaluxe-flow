import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function validateAddress(zip: string) {
  const cleanZip = zip.replace(/\D/g, '').slice(0, 5);
  
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${cleanZip}`);
    
    if (!response.ok) {
      return { is_valid: false };
    }

    const data = await response.json();
    const place = data.places[0];

    return {
      is_valid: true,
      suggested_city: place['place name'],
      suggested_state: place['state abbreviation'],
    };
  } catch (error) {
    return { is_valid: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { entity_type } = await req.json();

    const results = {
      providers: { verified: 0, invalid: 0, total: 0 },
      pharmacies: { verified: 0, invalid: 0, total: 0 },
      patients: { verified: 0, invalid: 0, total: 0 },
    };

    // Verify providers (profiles table)
    if (!entity_type || entity_type === 'providers' || entity_type === 'all') {
      const { data: providers } = await supabaseClient
        .from('profiles')
        .select('id, address_zip, shipping_address_zip, address_verification_status, shipping_address_verification_status')
        .or('address_verification_status.neq.verified,shipping_address_verification_status.neq.verified');

      results.providers.total = providers?.length || 0;

      for (const provider of providers || []) {
        if (provider.address_zip && provider.address_verification_status !== 'verified') {
          const validation = await validateAddress(provider.address_zip);
          await supabaseClient
            .from('profiles')
            .update({
              address_verification_status: validation.is_valid ? 'verified' : 'invalid',
              address_verified_at: new Date().toISOString(),
              address_city: validation.suggested_city,
              address_state: validation.suggested_state,
            })
            .eq('id', provider.id);

          if (validation.is_valid) results.providers.verified++;
          else results.providers.invalid++;
        }

        if (provider.shipping_address_zip && provider.shipping_address_verification_status !== 'verified') {
          const validation = await validateAddress(provider.shipping_address_zip);
          await supabaseClient
            .from('profiles')
            .update({
              shipping_address_verification_status: validation.is_valid ? 'verified' : 'invalid',
              shipping_address_verified_at: new Date().toISOString(),
              shipping_address_city: validation.suggested_city,
              shipping_address_state: validation.suggested_state,
            })
            .eq('id', provider.id);

          if (validation.is_valid) results.providers.verified++;
          else results.providers.invalid++;
        }
      }
    }

    // Verify pharmacies
    if (!entity_type || entity_type === 'pharmacies' || entity_type === 'all') {
      const { data: pharmacies } = await supabaseClient
        .from('pharmacies')
        .select('id, address_zip, address_verification_status')
        .neq('address_verification_status', 'verified');

      results.pharmacies.total = pharmacies?.length || 0;

      for (const pharmacy of pharmacies || []) {
        if (pharmacy.address_zip) {
          const validation = await validateAddress(pharmacy.address_zip);
          await supabaseClient
            .from('pharmacies')
            .update({
              address_verification_status: validation.is_valid ? 'verified' : 'invalid',
              address_verified_at: new Date().toISOString(),
              address_city: validation.suggested_city,
              address_state: validation.suggested_state,
            })
            .eq('id', pharmacy.id);

          if (validation.is_valid) results.pharmacies.verified++;
          else results.pharmacies.invalid++;
        }
      }
    }

    // Verify patients
    if (!entity_type || entity_type === 'patients' || entity_type === 'all') {
      const { data: patients } = await supabaseClient
        .from('patients')
        .select('id, address_zip, address_verification_status')
        .neq('address_verification_status', 'verified');

      results.patients.total = patients?.length || 0;

      for (const patient of patients || []) {
        if (patient.address_zip) {
          const validation = await validateAddress(patient.address_zip);
          await supabaseClient
            .from('patients')
            .update({
              address_verification_status: validation.is_valid ? 'verified' : 'invalid',
              address_verified_at: new Date().toISOString(),
              address_city: validation.suggested_city,
              address_state: validation.suggested_state,
            })
            .eq('id', patient.id);

          if (validation.is_valid) results.patients.verified++;
          else results.patients.invalid++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Bulk verification complete. Providers: ${results.providers.verified}/${results.providers.total} verified. Pharmacies: ${results.pharmacies.verified}/${results.pharmacies.total} verified. Patients: ${results.patients.verified}/${results.patients.total} verified.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Bulk verification error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
