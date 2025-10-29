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

    const { providerId, appointmentDate, appointmentTime, reasonForVisit, visitType, notes } = await req.json();

    // Get patient's assigned practice from patient_accounts
    const { data: patientAccount, error: patientError } = await supabaseClient
      .from('patient_accounts')
      .select('practice_id, id')
      .eq('user_id', user.id)
      .single();

    if (patientError || !patientAccount) {
      throw new Error('Patient account not found. Please contact your healthcare provider.');
    }

    const fullDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    const endDateTime = new Date(fullDateTime.getTime() + 60 * 60 * 1000); // +1 hour default

    // Validation 1: Check if date is in the past
    if (fullDateTime <= new Date()) {
      throw new Error('Cannot book appointments in the past');
    }

    // Validation 2: Check if practice is open on this day
    const dayOfWeek = fullDateTime.getDay();
    const { data: hours, error: hoursError } = await supabaseClient
      .from('practice_calendar_hours')
      .select('start_time, end_time, is_closed')
      .eq('practice_id', patientAccount.practice_id)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle();

    if (hoursError) throw hoursError;

    if (!hours || hours.is_closed) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      throw new Error(`Practice is closed on ${dayNames[dayOfWeek]}s`);
    }

    // Validation 3: Check if time is within business hours
    if (appointmentTime < hours.start_time || appointmentTime >= hours.end_time) {
      throw new Error(`Practice hours are ${hours.start_time} - ${hours.end_time}`);
    }

    // Validation 4: Check if time is blocked
    const { data: blocked, error: blockedError } = await supabaseClient
      .from('practice_blocked_time')
      .select('reason')
      .eq('practice_id', patientAccount.practice_id)
      .lte('start_time', fullDateTime.toISOString())
      .gte('end_time', fullDateTime.toISOString())
      .maybeSingle();

    if (blockedError) throw blockedError;
    if (blocked) {
      throw new Error(`This time slot is blocked${blocked.reason ? ': ' + blocked.reason : ''}`);
    }

    // Validation 5: Check for appointment conflicts
    const { data: conflicts, error: conflictError } = await supabaseClient
      .from('patient_appointments')
      .select('id')
      .eq('practice_id', patientAccount.practice_id)
      .not('status', 'in', '(cancelled,no_show)')
      .lt('start_time', endDateTime.toISOString())
      .gt('end_time', fullDateTime.toISOString());

    if (conflictError) throw conflictError;
    if (conflicts && conflicts.length > 0) {
      throw new Error('This time slot is already booked. Please choose another time.');
    }

    const { data, error } = await supabaseClient
      .from('patient_appointments')
      .insert({
        patient_id: patientAccount.id,
        practice_id: patientAccount.practice_id,
        provider_id: providerId || null,
        start_time: fullDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        reason_for_visit: reasonForVisit,
        visit_type: visitType || 'in_person',
        status: 'pending',
        confirmation_type: 'pending',
        requested_date: appointmentDate,
        requested_time: appointmentTime,
        notes
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
