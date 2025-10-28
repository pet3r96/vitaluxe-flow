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

    const { practiceId, providerId, appointmentDate, appointmentTime, reasonForVisit, notes } = await req.json();

    const fullDateTime = new Date(`${appointmentDate}T${appointmentTime}`);

    const { data, error } = await supabaseClient
      .from('patient_appointments')
      .insert({
        patient_id: user.id,
        practice_id: practiceId,
        provider_id: providerId,
        appointment_date: fullDateTime.toISOString(),
        reason_for_visit: reasonForVisit,
        notes,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, appointment: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
