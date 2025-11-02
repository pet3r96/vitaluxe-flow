import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const { patient_account_id } = body;

    if (!patient_account_id) {
      throw new Error('patient_account_id is required');
    }

    console.log('Fetching patient vault data for patient:', patient_account_id);

    // Fetch patient account data
    const { data: patientAccount, error: patientError } = await supabase
      .from('patient_accounts')
      .select('id, first_name, last_name, practice_id, date_of_birth, address, city, state, zip_code, gender_at_birth, user_id, birth_date, address_street, address_city, address_state, address_zip, address_formatted, email, phone')
      .eq('id', patient_account_id)
      .single();

    if (patientError) {
      console.error('Error fetching patient account:', patientError);
      throw patientError;
    }

    if (!patientAccount) {
      throw new Error('Patient account not found');
    }

    console.log('Successfully fetched patient vault data');

    return new Response(
      JSON.stringify({ patient: patientAccount }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in get-patient-vault-data:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        patient: null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
