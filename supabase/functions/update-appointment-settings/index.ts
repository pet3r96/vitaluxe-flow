import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    const { 
      practiceId, 
      slotDuration, 
      startHour, 
      endHour, 
      workingDays, 
      bufferTime, 
      allowOverlap,
      daySettings,
      timezone
    } = await req.json();

    edgeLogger.info('[update-appointment-settings] Updating settings', { practiceId });

    // Validate inputs
    if (!practiceId) {
      throw new Error('Practice ID is required');
    }

    if (slotDuration && ![15, 30, 45, 60].includes(slotDuration)) {
      throw new Error('Slot duration must be 15, 30, 45, or 60 minutes');
    }

    if (startHour !== undefined && (startHour < 0 || startHour > 23)) {
      throw new Error('Start hour must be between 0 and 23');
    }

    if (endHour !== undefined && (endHour < 0 || endHour > 23)) {
      throw new Error('End hour must be between 0 and 23');
    }

    if (startHour !== undefined && endHour !== undefined && startHour >= endHour) {
      throw new Error('Start hour must be before end hour');
    }

    // Update practice_calendar_hours for all days based on settings
    const defaultWorkingDays = workingDays || [1, 2, 3, 4, 5];
    const defaultStartTime = `${String(startHour ?? 8).padStart(2, '0')}:00:00`;
    const defaultEndTime = `${String(endHour ?? 18).padStart(2, '0')}:00:00`;
    const defaultTimezone = timezone || 'America/New_York';

    if (daySettings && Array.isArray(daySettings) && daySettings.length > 0) {
      // Use specific day settings if provided
      for (const daySetting of daySettings) {
        const { dayOfWeek, enabled, startTime, endTime } = daySetting;
        
        if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) continue;

        const { error: calendarError } = await supabaseClient
          .from('practice_calendar_hours')
          .upsert({
            practice_id: practiceId,
            day_of_week: dayOfWeek,
            start_time: startTime || defaultStartTime,
            end_time: endTime || defaultEndTime,
            is_closed: !enabled
          }, {
            onConflict: 'practice_id,day_of_week'
          });

        if (calendarError) {
          edgeLogger.error('[update-appointment-settings] Error upserting calendar hours', { 
            errorMessage: calendarError.message,
            errorDetails: calendarError.details,
            errorCode: calendarError.code,
            dayOfWeek 
          });
          throw new Error(`Failed to upsert calendar hours for day ${dayOfWeek}: ${calendarError.message || JSON.stringify(calendarError)}`);
        }
      }
      edgeLogger.info('[update-appointment-settings] Day-specific calendar hours updated successfully');
    } else {
      // Use default working days if no specific day settings provided
      for (let day = 0; day <= 6; day++) {
        const isWorking = defaultWorkingDays.includes(day);
        const { error: calendarError } = await supabaseClient
          .from('practice_calendar_hours')
          .upsert({
            practice_id: practiceId,
            day_of_week: day,
            start_time: isWorking ? defaultStartTime : '09:00:00',
            end_time: isWorking ? defaultEndTime : '17:00:00',
            is_closed: !isWorking
          }, {
            onConflict: 'practice_id,day_of_week'
          });

        if (calendarError) {
          edgeLogger.error('[update-appointment-settings] Error upserting calendar hours', { 
            errorMessage: calendarError.message,
            errorDetails: calendarError.details,
            errorCode: calendarError.code,
            day 
          });
          throw new Error(`Failed to upsert calendar hours for day ${day}: ${calendarError.message || JSON.stringify(calendarError)}`);
        }
      }
      edgeLogger.info('[update-appointment-settings] Default calendar hours updated successfully');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Calendar hours updated successfully',
        practiceId,
        timezone: defaultTimezone
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    edgeLogger.error('[update-appointment-settings] Fatal error', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});