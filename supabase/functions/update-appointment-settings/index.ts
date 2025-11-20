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

    // Upsert appointment settings
    const updateData: any = {
      practice_id: practiceId,
      slot_duration: slotDuration || 15,
      start_hour: startHour ?? 8,
      end_hour: endHour ?? 18,
      working_days: workingDays || [1, 2, 3, 4, 5],
      buffer_time: bufferTime ?? 0,
      allow_overlap: allowOverlap ?? false,
      updated_at: new Date().toISOString(),
    };

    // Store general settings in practice_calendar_hours as default for all days if no daySettings
    // This maintains backward compatibility while using the new table
    let data = { success: true };
    
    if (!daySettings || daySettings.length === 0) {
      // No per-day settings, create default for working days
      const defaultWorkingDays = workingDays || [1, 2, 3, 4, 5];
      
      for (let day = 0; day <= 6; day++) {
        const isWorking = defaultWorkingDays.includes(day);
        const { error: calendarError } = await supabaseClient
          .from('practice_calendar_hours')
          .upsert({
            practice_id: practiceId,
            day_of_week: day,
            start_time: isWorking ? `${String(startHour ?? 8).padStart(2, '0')}:00:00` : '09:00:00',
            end_time: isWorking ? `${String(endHour ?? 18).padStart(2, '0')}:00:00` : '17:00:00',
            is_closed: !isWorking,
            timezone: timezone || 'America/New_York'
          }, {
            onConflict: 'practice_id,day_of_week'
          });

        if (calendarError) {
          edgeLogger.error('[update-appointment-settings] Error upserting calendar hours', calendarError);
          throw calendarError;
        }
      }
    }

    edgeLogger.info('[update-appointment-settings] Settings updated successfully');

    // If daySettings provided, upsert per-day hours into practice_calendar_hours
    if (daySettings && Array.isArray(daySettings)) {
      for (const daySetting of daySettings) {
        const { dayOfWeek, enabled, startTime, endTime } = daySetting;
        
        if (typeof dayOfWeek !== 'number') continue;

        const { error: calendarError } = await supabaseClient
          .from('practice_calendar_hours')
          .upsert({
            practice_id: practiceId,
            day_of_week: dayOfWeek,
            start_time: startTime || '09:00:00',
            end_time: endTime || '17:00:00',
            is_closed: !enabled,
          }, {
            onConflict: 'practice_id,day_of_week'
          });

        if (calendarError) {
          edgeLogger.error('[update-appointment-settings] Error upserting calendar hours', calendarError, { dayOfWeek });
        }
      }
      edgeLogger.info('[update-appointment-settings] Calendar hours updated successfully');
    }

    return new Response(
      JSON.stringify({ success: true, data }),
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