import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { appointmentId } = await req.json();

    // Fetch appointment details
    const { data: appointment, error } = await supabaseClient
      .from('patient_appointments')
      .select(`
        id, start_time, end_time, visit_type, reason_for_visit,
        practice:profiles!patient_appointments_practice_id_fkey(full_name, name, address_street, address_city, address_state, address_zip)
      `)
      .eq('id', appointmentId)
      .single();

    if (error || !appointment) throw new Error('Appointment not found');
    
    console.log('📅 Generating calendar event for appointment:', appointmentId);
    console.log('Practice data:', appointment.practice);

    // Generate ICS format
    const startDate = new Date(appointment.start_time);
    let endDate = new Date(appointment.end_time);
    if (isNaN(endDate.getTime())) {
      endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
    }
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const practice = Array.isArray(appointment.practice) ? appointment.practice[0] : appointment.practice;
    const practiceName = practice?.full_name || practice?.name || 'Healthcare Practice';
    const providerName = 'Provider';
    
    // Build address safely with fallback
    const addressParts = [
      practice?.address_street,
      practice?.address_city,
      practice?.address_state,
      practice?.address_zip
    ].filter(Boolean);
    
    const location = appointment.visit_type === 'video' 
      ? 'Virtual Appointment - Video Call' 
      : appointment.visit_type === 'phone'
      ? 'Phone Appointment - Provider will call you'
      : addressParts.length > 0 
        ? addressParts.join(', ') 
        : 'Address TBD - Please contact practice for location details';

    // Enhanced description for better mobile display
    const description = [
      appointment.reason_for_visit || 'Healthcare appointment',
      `Provider: ${providerName}`,
      `Visit Type: ${appointment.visit_type || 'In-Person'}`,
      `Practice: ${practiceName}`
    ].join('\\n');

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Healthcare App//Appointment//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Healthcare Appointments
X-WR-TIMEZONE:America/New_York
BEGIN:VEVENT
UID:${appointmentId}@healthcareapp.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:Appointment with ${practiceName}
DESCRIPTION:${description}
LOCATION:${location}
ORGANIZER;CN=${practiceName}:MAILTO:noreply@healthcareapp.com
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Appointment reminder: ${practiceName}
END:VALARM
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
