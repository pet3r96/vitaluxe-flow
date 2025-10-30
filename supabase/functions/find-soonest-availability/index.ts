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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Start searching from tomorrow
    const searchStart = new Date(today);
    searchStart.setDate(searchStart.getDate() + 1);
    
    // Search up to 30 days ahead
    const maxDays = 30;
    
    for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
      const checkDate = new Date(searchStart);
      checkDate.setDate(checkDate.getDate() + dayOffset);
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
      // Skip if closed or no hours defined
      if (!practiceHours || practiceHours.is_closed) continue;

      // Generate 30-minute time slots
      const startTimeStr = practiceHours.start_time.toString();
      const endTimeStr = practiceHours.end_time.toString();
      const startHour = parseInt(startTimeStr.split(':')[0]);
      const startMin = parseInt(startTimeStr.split(':')[1]);
      const endHour = parseInt(endTimeStr.split(':')[0]);
      const endMin = parseInt(endTimeStr.split(':')[1]);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
        const slotHour = Math.floor(minutes / 60);
        const slotMin = minutes % 60;
        const timeSlot = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;
        
        const slotDateTime = new Date(checkDate);
        slotDateTime.setHours(slotHour, slotMin, 0, 0);
        
        const endSlotDateTime = new Date(slotDateTime);
        endSlotDateTime.setMinutes(endSlotDateTime.getMinutes() + duration);
        
        // Check if this slot is blocked
        const { data: blocked, error: blockedError } = await supabaseClient
          .from('practice_blocked_time')
          .select('id')
          .eq('practice_id', practiceId)
          .lte('start_time', slotDateTime.toISOString())
          .gte('end_time', slotDateTime.toISOString())
          .maybeSingle();

        if (blockedError) {
          console.error('Error checking blocked time:', blockedError);
          continue;
        }
        if (blocked) continue;
        
        // Check if there's an appointment conflict
        const { data: conflicts, error: conflictError } = await supabaseClient
          .from('patient_appointments')
          .select('id')
          .eq('practice_id', practiceId)
          .not('status', 'in', '(cancelled,no_show)')
          .lt('start_time', endSlotDateTime.toISOString())
          .gt('end_time', slotDateTime.toISOString());

        if (conflictError) {
          console.error('Error checking conflicts:', conflictError);
          continue;
        }
        if (conflicts && conflicts.length > 0) continue;
        
        // Found an available slot!
        const dateStr = checkDate.toISOString().split('T')[0];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[checkDate.getDay()];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = monthNames[checkDate.getMonth()];
        const day = checkDate.getDate();
        
        // Format time for display (12-hour format)
        const displayHour = slotHour > 12 ? slotHour - 12 : (slotHour === 0 ? 12 : slotHour);
        const ampm = slotHour >= 12 ? 'PM' : 'AM';
        const displayTime = `${displayHour}:${String(slotMin).padStart(2, '0')} ${ampm}`;
        
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
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
