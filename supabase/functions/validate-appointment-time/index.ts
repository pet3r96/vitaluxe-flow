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

    // Check for active impersonation session
    const { data: impersonationSession } = await supabaseClient
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    const effectiveUserId = impersonationSession?.impersonated_user_id || user.id;

    const { appointmentDate, appointmentTime, clientDateTimeIso, timezoneOffsetMinutes, duration = 60 } = await req.json();

    if (!appointmentDate || !appointmentTime) {
      throw new Error('Date and time are required');
    }

    // Get patient's practice using effective user ID
    const { data: patientAccount, error: patientError } = await supabaseClient
      .from('patient_accounts')
      .select('practice_id')
      .eq('user_id', effectiveUserId)
      .single();

    if (patientError || !patientAccount) {
      throw new Error('Patient account not found');
    }

    const practiceId = patientAccount.practice_id;
    
    // Get practice timezone from appointment_settings
    const { data: appointmentSettings } = await supabaseClient
      .from('appointment_settings')
      .select('timezone')
      .eq('practice_id', practiceId)
      .single();
    
    const practiceTimezone = appointmentSettings?.timezone || 'America/New_York';
    
    // Helpers for time calculations in practice timezone
    const parseTimeToMinutes = (time: string) => {
      const parts = time.split(':');
      const h = parseInt(parts[0] || '0', 10);
      const m = parseInt(parts[1] || '0', 10);
      return h * 60 + m;
    };
    const minutesToHHMM = (mins: number) => {
      const h = Math.floor(mins / 60) % 24;
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    const addMinutesToHHMM = (time: string, add: number) => minutesToHHMM(parseTimeToMinutes(time) + add);
    const toUTCISOInTZ = (dateYMD: string, timeHM: string, tz: string) => {
      const [y, mo, d] = dateYMD.split('-').map(Number);
      const [hh, mm] = timeHM.split(':').map(Number);
      // Create a UTC date with the same components
      const utcBase = new Date(Date.UTC(y, (mo - 1), d, hh, mm, 0));
      // Invert using the target timezone to derive correct UTC instant
      const inv = new Date(utcBase.toLocaleString('en-US', { timeZone: tz }));
      const diff = utcBase.getTime() - inv.getTime();
      const actual = new Date(utcBase.getTime() + diff);
      return actual.toISOString();
    };

    // Compute appointment times in practice timezone
    const startTimeHM = appointmentTime;
    const endTimeHM = addMinutesToHHMM(startTimeHM, duration);
    const startIso = toUTCISOInTZ(appointmentDate, startTimeHM, practiceTimezone);
    const endIso = toUTCISOInTZ(appointmentDate, endTimeHM, practiceTimezone);
    // Get current time in practice timezone for comparison
    // 1. Check if date/time is in the past (compare in practice timezone)
    const nowInPracticeTime = new Date(new Date().toLocaleString('en-US', { timeZone: practiceTimezone }));
    const todayYMD = nowInPracticeTime.toLocaleDateString('en-CA', { timeZone: practiceTimezone }); // YYYY-MM-DD
    const nowMinutes = nowInPracticeTime.getHours() * 60 + nowInPracticeTime.getMinutes();
    if (appointmentDate < todayYMD || (appointmentDate === todayYMD && parseTimeToMinutes(startTimeHM) <= nowMinutes)) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Cannot book appointments in the past',
          alternatives: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const apptDateInTZ = new Date(new Date(`${appointmentDate}T00:00:00`).toLocaleString('en-US', { timeZone: practiceTimezone }));
    const dayOfWeek = apptDateInTZ.getDay();

    // 2. Check if practice is open on this day (using RPC with defaults)
    const { data: hours, error: hoursError } = await supabaseClient
      .rpc('get_practice_hours_with_defaults', {
        p_practice_id: practiceId,
        p_day_of_week: dayOfWeek
      });

    if (hoursError) throw hoursError;

    const practiceHours = hours?.[0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];

    if (!practiceHours || practiceHours.is_closed) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Practice is closed on ${dayName}s`,
          alternatives: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if time is within business hours (and respects end-of-day buffer)
    const startTimeStr = practiceHours.start_time.toString();
    const endTimeStr = practiceHours.end_time.toString();

    // Helpers
    const normalizeTime = (time: string) => {
      const parts = time.split(':');
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    };
    const formatTime = (time: string) => {
      const [h, m] = time.split(':');
      const hour = parseInt(h);
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      return `${displayHour}:${m} ${ampm}`;
    };

    const appointmentTimeNorm = normalizeTime(startTimeHM);
    const appointmentEndTimeNorm = normalizeTime(endTimeHM);
    const startTimeNorm = normalizeTime(startTimeStr);
    const endTimeNorm = normalizeTime(endTimeStr);

    // Minutes-of-day for robust comparisons
    const practiceStartMin = parseTimeToMinutes(startTimeNorm);
    const practiceEndMin = parseTimeToMinutes(endTimeNorm);
    const apptStartMin = parseTimeToMinutes(appointmentTimeNorm);
    const apptEndMin = parseTimeToMinutes(appointmentEndTimeNorm);

    // Enforce end-of-day buffer (last appointment must end at least 60 minutes before closing)
    const endOfDayBufferMin = 60;

    if (apptStartMin < practiceStartMin) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Practice hours start at ${formatTime(startTimeNorm)}`,
          alternatives: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (apptStartMin + duration > (practiceEndMin - endOfDayBufferMin)) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Last appointment must end at least 60 minutes before closing (${formatTime(endTimeNorm)})`,
          alternatives: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check if time is blocked (overlap)
    const { data: blocked, error: blockedError } = await supabaseClient
      .from('practice_blocked_time')
      .select('id, reason')
      .eq('practice_id', practiceId)
      .lt('start_time', endIso)
      .gt('end_time', startIso);

    if (blockedError) throw blockedError;

    if (blocked && blocked.length > 0) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `This time slot is blocked${blocked[0].reason ? ': ' + blocked[0].reason : ''}`,
          alternatives: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Check for appointment conflicts (overlap)
    const { data: conflicts, error: conflictError } = await supabaseClient
      .from('patient_appointments')
      .select('id')
      .eq('practice_id', practiceId)
      .not('status', 'in', '(cancelled,no_show)')
      .lt('start_time', endIso)
      .gt('end_time', startIso);

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
      JSON.stringify({ 
        valid: false,
        error: error.message || 'Unable to validate appointment time. Please try again.',
        alternatives: []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
