import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { appointmentId, newDate, newTime, reason, clientDateTimeIso, timezoneOffsetMinutes } = await req.json();
    
    console.log('Reschedule request:', { appointmentId, newDate, newTime, clientDateTimeIso, timezoneOffsetMinutes });

    // Verify patient owns this appointment
    const { data: appointment, error: fetchError } = await supabaseClient
      .from('patient_appointments')
      .select('id, patient_accounts!inner(user_id)')
      .eq('id', appointmentId)
      .eq('patient_accounts.user_id', user.id)
      .single();

    if (fetchError || !appointment) {
      throw new Error('Appointment not found or access denied');
    }

    // Update appointment with reschedule request
    const { data, error } = await supabaseClient
      .from('patient_appointments')
      .update({
        requested_date: newDate,
        requested_time: newTime,
        reschedule_requested_at: new Date().toISOString(),
        reschedule_reason: reason,
        confirmation_type: 'pending',
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)
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
