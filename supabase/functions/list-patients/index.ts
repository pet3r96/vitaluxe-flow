import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Authenticated user:', user.id);

    // Get practice_id from request body or determine from user role
    const body = await req.json();
    let practiceId = body.practice_id;

    // If no practice_id provided, determine from user's role
    if (!practiceId) {
      // Check if user is a doctor/provider
      const { data: providerData } = await supabase
        .from('providers')
        .select('practice_id')
        .eq('user_id', user.id)
        .single();

      if (providerData) {
        practiceId = providerData.practice_id;
      } else {
        // Check if user is staff
        const { data: staffData } = await supabase
          .from('practice_staff')
          .select('practice_id')
          .eq('user_id', user.id)
          .single();

        if (staffData) {
          practiceId = staffData.practice_id;
        }
      }
    }

    if (!practiceId) {
      throw new Error('Could not determine practice_id');
    }

    console.log('Fetching patients for practice:', practiceId);

    // Fetch patients for the practice
    const { data: patients, error: patientsError } = await supabase
      .from('patient_accounts')
      .select('id, user_id, first_name, last_name, email, phone, address, address_street, address_city, address_state, address_zip, address_formatted')
      .eq('practice_id', practiceId)
      .order('last_name', { ascending: true });

    if (patientsError) {
      console.error('Error fetching patients:', patientsError);
      throw patientsError;
    }

    console.log(`Found ${patients?.length || 0} patients`);

    return new Response(
      JSON.stringify({ patients: patients || [] }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in list-patients:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        patients: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
