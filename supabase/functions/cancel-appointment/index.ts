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

    const { appointmentId } = await req.json();

    // First get patient_account for this user
    const { data: patientAccount, error: paError } = await supabaseClient
      .from('patient_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (paError || !patientAccount) {
      console.error('Patient account not found:', paError);
      throw new Error('Patient account not found');
    }

    // Then verify appointment belongs to this patient
    const { data: appointment, error: fetchError } = await supabaseClient
      .from('patient_appointments')
      .select('id, patient_id')
      .eq('id', appointmentId)
      .eq('patient_id', patientAccount.id)
      .single();

    if (fetchError || !appointment) {
      console.error('Appointment verification failed:', fetchError);
      throw new Error('Appointment not found or access denied');
    }

    const { error } = await supabaseClient
      .from('patient_appointments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString(), cancelled_at: new Date().toISOString() })
      .eq('id', appointmentId);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
