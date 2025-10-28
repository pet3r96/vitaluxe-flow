import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { 
      practiceId, 
      slotDuration, 
      startHour, 
      endHour, 
      workingDays, 
      bufferTime, 
      allowOverlap 
    } = await req.json();

    console.log('Updating appointment settings for practice:', practiceId);

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
    const { data, error } = await supabaseClient
      .from('appointment_settings')
      .upsert({
        practice_id: practiceId,
        slot_duration: slotDuration || 15,
        start_hour: startHour ?? 8,
        end_hour: endHour ?? 18,
        working_days: workingDays || [1, 2, 3, 4, 5],
        buffer_time: bufferTime ?? 0,
        allow_overlap: allowOverlap ?? false,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'practice_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting appointment settings:', error);
      throw error;
    }

    console.log('Appointment settings updated successfully:', data);

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in update-appointment-settings:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});