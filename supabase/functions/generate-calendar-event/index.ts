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

    const { appointmentId } = await req.json();

    // Fetch appointment details
    const { data: appointment, error } = await supabaseClient
      .from('patient_appointments')
      .select(`
        *,
        practice:profiles!patient_appointments_practice_id_fkey(name, address_street, address_city, address_state, address_zip),
        provider:profiles!patient_appointments_provider_id_fkey(name)
      `)
      .eq('id', appointmentId)
      .single();

    if (error || !appointment) throw new Error('Appointment not found');

    // Generate ICS format
    const startDate = new Date(appointment.start_time);
    const endDate = new Date(appointment.end_time);
    
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const location = appointment.visit_type === 'virtual' 
      ? 'Virtual Appointment' 
      : `${appointment.practice.address_street || ''}, ${appointment.practice.address_city || ''}, ${appointment.practice.address_state || ''} ${appointment.practice.address_zip || ''}`.trim();

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Healthcare App//Appointment//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${appointmentId}@healthcareapp.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:Appointment with ${appointment.practice.name}
DESCRIPTION:${appointment.reason_for_visit || 'Healthcare appointment'}${appointment.provider ? ` with ${appointment.provider.name}` : ''}
LOCATION:${location}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

    return new Response(icsContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar',
        'Content-Disposition': `attachment; filename="appointment-${appointmentId}.ics"`,
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
