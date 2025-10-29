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

    const { appointmentDate, appointmentTime, duration = 60 } = await req.json();

    if (!appointmentDate || !appointmentTime) {
      throw new Error('Date and time are required');
    }

    // Get patient's practice
    const { data: patientAccount, error: patientError } = await supabaseClient
      .from('patient_accounts')
      .select('practice_id')
      .eq('user_id', user.id)
      .single();

    if (patientError || !patientAccount) {
      throw new Error('Patient account not found');
    }

    const practiceId = patientAccount.practice_id;
    const requestedDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    const endDateTime = new Date(requestedDateTime.getTime() + duration * 60 * 1000);

    // 1. Check if date is in the past
    if (requestedDateTime <= new Date()) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Cannot book appointments in the past',
          alternatives: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dayOfWeek = requestedDateTime.getDay();

    // 2. Check if practice is open on this day
    const { data: hours, error: hoursError } = await supabaseClient
      .from('practice_calendar_hours')
      .select('start_time, end_time, is_closed')
      .eq('practice_id', practiceId)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle();

    if (hoursError) throw hoursError;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];

    if (!hours || hours.is_closed) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Practice is closed on ${dayName}s`,
          alternatives: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if time is within business hours
    if (appointmentTime < hours.start_time || appointmentTime >= hours.end_time) {
      // Format times for display
      const formatTime = (time: string) => {
        const [h, m] = time.split(':');
        const hour = parseInt(h);
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        return `${displayHour}:${m} ${ampm}`;
      };

      return new Response(
        JSON.stringify({
          valid: false,
          error: `Practice hours are ${formatTime(hours.start_time)} - ${formatTime(hours.end_time)}`,
          alternatives: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check if time is blocked
    const { data: blocked, error: blockedError } = await supabaseClient
      .from('practice_blocked_time')
      .select('reason')
      .eq('practice_id', practiceId)
      .lte('start_time', requestedDateTime.toISOString())
      .gte('end_time', requestedDateTime.toISOString())
      .maybeSingle();

    if (blockedError) throw blockedError;

    if (blocked) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `This time slot is blocked${blocked.reason ? ': ' + blocked.reason : ''}`,
          alternatives: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Check for appointment conflicts
    const { data: conflicts, error: conflictError } = await supabaseClient
      .from('patient_appointments')
      .select('id')
      .eq('practice_id', practiceId)
      .not('status', 'in', '(cancelled,no_show)')
      .lt('start_time', endDateTime.toISOString())
      .gt('end_time', requestedDateTime.toISOString());

    if (conflictError) throw conflictError;

    if (conflicts && conflicts.length > 0) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'This time slot is already booked',
          alternatives: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Time is valid!
    return new Response(
      JSON.stringify({
        valid: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error validating appointment time:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
