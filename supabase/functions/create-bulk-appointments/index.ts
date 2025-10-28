import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { appointments } = await req.json();

    if (!appointments || !Array.isArray(appointments) || appointments.length === 0) {
      throw new Error('appointments array is required and must not be empty');
    }

    // Validate all appointments have required fields
    for (const appt of appointments) {
      if (!appt.patient_id || !appt.practice_id || !appt.provider_id || !appt.start_time || !appt.end_time) {
        throw new Error('Each appointment must have patient_id, practice_id, provider_id, start_time, and end_time');
      }
    }

    // Add created_by to all appointments
    const appointmentsWithCreator = appointments.map(appt => ({
      ...appt,
      created_by: user.id,
      status: appt.status || 'scheduled'
    }));

    // Bulk insert
    const { data: created, error: insertError } = await supabaseClient
      .from('patient_appointments')
      .insert(appointmentsWithCreator)
      .select();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        appointments: created,
        count: created?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Create bulk appointments error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
