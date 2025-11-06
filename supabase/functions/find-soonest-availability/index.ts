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

    const { duration = 60 } = await req.json();

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
    
    // Helpers for time and timezone-safe comparisons
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
    const toUTCISOInTZ = (dateYMD: string, timeHM: string, tz: string) => {
      const [y, mo, d] = dateYMD.split('-').map(Number);
      const [hh, mm] = timeHM.split(':').map(Number);
      const utcBase = new Date(Date.UTC(y, (mo - 1), d, hh, mm, 0));
      const inv = new Date(utcBase.toLocaleString('en-US', { timeZone: tz }));
      const diff = utcBase.getTime() - inv.getTime();
      return new Date(utcBase.getTime() + diff).toISOString();
    };

    // Get current time in practice timezone using Intl API
    const nowUTC = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: practiceTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(nowUTC);
    const getPart = (type: string) => parts.find((p: any) => p.type === type)?.value || '0';
    
    const todayYear = parseInt(getPart('year'));
    const todayMonth = parseInt(getPart('month'));
    const todayDay = parseInt(getPart('day'));
    const nowHour = parseInt(getPart('hour'));
    const nowMinute = parseInt(getPart('minute'));
    const nowMinutes = nowHour * 60 + nowMinute;
    
    const todayYMD = `${todayYear}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

    console.log('[find-soonest-availability] Starting search:', JSON.stringify({
      practiceTimezone,
      todayYMD,
      nowMinutes,
      nowUTC: nowUTC.toISOString(),
      duration
    }));

    // Search up to 30 days ahead
    const maxDays = 30;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
      // Calculate the date in YYYY-MM-DD format
      const checkDate = new Date(todayYear, todayMonth - 1, todayDay + dayOffset);
      const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      const dayOfWeek = checkDate.getDay(); // 0 = Sunday, 6 = Saturday
      
      // Get practice hours for this day (using RPC with defaults)
      const { data: hours, error: hoursError } = await supabaseClient
        .rpc('get_practice_hours_with_defaults', {
          p_practice_id: practiceId,
          p_day_of_week: dayOfWeek
        });

      if (hoursError) {
        console.error('Error fetching hours:', hoursError);
        continue;
      }

      const practiceHours = hours?.[0];
      
      console.log(`[find-soonest-availability] Day ${dayOfWeek} (${dayNames[dayOfWeek]})`, JSON.stringify({
        dateStr,
        dayOffset,
        practiceHours: practiceHours ? {
          start: practiceHours.start_time,
          end: practiceHours.end_time,
          isClosed: practiceHours.is_closed
        } : null
      }));

      // Skip if closed or no hours defined
      if (!practiceHours || practiceHours.is_closed) {
        console.log(`[find-soonest-availability] Day ${dayOfWeek} SKIPPED: Closed`);
        continue;
      }

      // Generate time slots within practice hours
      const startTimeStr = practiceHours.start_time.toString();
      const endTimeStr = practiceHours.end_time.toString();
      const startHour = parseInt(startTimeStr.split(':')[0]);
      const startMin = parseInt(startTimeStr.split(':')[1]);
      const endHour = parseInt(endTimeStr.split(':')[0]);
      const endMin = parseInt(endTimeStr.split(':')[1]);
      console.log('[find-soonest-availability] Day', dayOfWeek, 'hours', { startTimeStr, endTimeStr, duration });
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      // Determine starting minute for scanning
      let firstMinute = startMinutes;
      if (dayOffset === 0) {
        const nextSlot = Math.ceil((nowMinutes + 1) / 30) * 30; // next 30-min boundary after now
        firstMinute = Math.max(startMinutes, nextSlot);
        console.log(`[find-soonest-availability] Today: Starting from ${minutesToHHMM(firstMinute)} (now=${minutesToHHMM(nowMinutes)})`);
      }

      // Latest start time (appointment can end exactly at closing)
      const latestStart = endMinutes - duration;
      console.log(`[find-soonest-availability] Scan range: ${minutesToHHMM(firstMinute)} to ${minutesToHHMM(latestStart)}`);
      
      if (firstMinute > latestStart) {
        console.log(`[find-soonest-availability] Day ${dayOfWeek} SKIPPED: No valid time slots`);
        continue;
      }

      // dateStr was already calculated above
      for (let minutes = firstMinute; minutes <= latestStart; minutes += 30) {
        const slotHour = Math.floor(minutes / 60);
        const slotMin = minutes % 60;
        const timeSlot = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;
        const slotEndMinutes = minutes + duration;
        const endTimeHM = minutesToHHMM(slotEndMinutes);

        const startIso = toUTCISOInTZ(dateStr, timeSlot, practiceTimezone);
        const endIso = toUTCISOInTZ(dateStr, endTimeHM, practiceTimezone);

        // Check if this slot is blocked (overlap)
        const { data: blocked, error: blockedError } = await supabaseClient
          .from('practice_blocked_time')
          .select('id')
          .eq('practice_id', practiceId)
          .lt('start_time', endIso)
          .gt('end_time', startIso);

        if (blockedError) {
          console.error('Error checking blocked time:', blockedError);
          continue;
        }
        if (blocked && blocked.length > 0) {
          console.log(`[find-soonest-availability] Slot ${timeSlot} BLOCKED (${blocked.length} conflicts)`);
          continue;
        }
        
        // Check if there's an appointment conflict (overlap)
        const { data: conflicts, error: conflictError } = await supabaseClient
          .from('patient_appointments')
          .select('id')
          .eq('practice_id', practiceId)
          .not('status', 'in', '(cancelled,no_show)')
          .lt('start_time', endIso)
          .gt('end_time', startIso);

        if (conflictError) {
          console.error('Error checking conflicts:', conflictError);
          continue;
        }
        if (conflicts && conflicts.length > 0) {
          console.log(`[find-soonest-availability] Slot ${timeSlot} CONFLICT (${conflicts.length} appointments)`);
          continue;
        }
        
        // Found an available slot!
        const dayName = dayNames[dayOfWeek];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = monthNames[checkDate.getMonth()];
        const day = checkDate.getDate();
        
        // Format time for display (12-hour format)
        const displayHour = slotHour > 12 ? slotHour - 12 : (slotHour === 0 ? 12 : slotHour);
        const ampm = slotHour >= 12 ? 'PM' : 'AM';
        const displayTime = `${displayHour}:${String(slotMin).padStart(2, '0')} ${ampm}`;
        
        console.log('[find-soonest-availability] Found slot', { date: dateStr, time: timeSlot, displayTime, day: dayName });
        return new Response(
          JSON.stringify({
            available: true,
            suggestedDate: dateStr,
            suggestedTime: timeSlot,
            message: `First available: ${dayName}, ${monthName} ${day} at ${displayTime}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // No availability found in 30 days
    return new Response(
      JSON.stringify({
        available: false,
        message: 'No availability found in the next 30 days. Please contact the practice directly.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error finding availability:', error);
    return new Response(
      JSON.stringify({ 
        available: false,
        message: error.message || 'Unable to find availability. Please try again.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
