import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function formatDateToICS(date: string): string {
  const d = new Date(date);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { startDate, endDate, providerId, roomId } = await req.json();

    // Get user role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const userRole = roleData?.role || 'doctor';

    // Determine practice context
    let practiceId: string | null = null;
    let userProviderId: string | null = null;

    if (userRole === 'doctor') {
      practiceId = user.id;
    } else if (userRole === 'provider') {
      const { data: providerData } = await supabaseClient
        .from('providers')
        .select('id, practice_id')
        .eq('user_id', user.id)
        .single();
      
      if (providerData) {
        userProviderId = providerData.id;
        practiceId = providerData.practice_id;
      }
    } else if (userRole === 'staff') {
      const { data: staffData } = await supabaseClient
        .from('practice_staff')
        .select('practice_id')
        .eq('user_id', user.id)
        .single();
      
      if (staffData) {
        practiceId = staffData.practice_id;
      }
    }

    // Build query
    let query = supabaseClient
      .from('patient_appointments')
      .select(`
        id,
        start_time,
        end_time,
        patient_id,
        provider_id,
        room_id,
        service_type,
        status,
        notes,
        patient_accounts!patient_appointments_patient_id_fkey (
          first_name,
          last_name
        ),
        providers!patient_appointments_provider_id_fkey (
          user_id,
          users!providers_user_id_fkey (
            email
          )
        ),
        practice_rooms (
          name
        )
      `)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true });

    // Apply date filters
    if (startDate) {
      query = query.gte('start_time', startDate);
    }
    if (endDate) {
      query = query.lte('start_time', endDate);
    }

    // Apply role-based filtering
    if (userRole === 'provider' && userProviderId) {
      query = query.eq('provider_id', userProviderId);
    } else if (practiceId) {
      query = query.eq('practice_id', practiceId);
    }

    // Apply optional filters
    if (providerId) {
      query = query.eq('provider_id', providerId);
    }
    if (roomId) {
      query = query.eq('room_id', roomId);
    }

    const { data: appointments, error: appointmentsError } = await query;

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      throw appointmentsError;
    }

    // Generate iCal content
    let icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//VitaLuxe//Practice Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:VitaLuxe Practice Calendar Export
X-WR-TIMEZONE:America/New_York
`;

    for (const apt of appointments || []) {
      const patient = Array.isArray(apt.patient_accounts) ? apt.patient_accounts[0] : apt.patient_accounts;
      const patientName = patient 
        ? `${patient.first_name} ${patient.last_name}`
        : 'Patient';
      
      const provider = Array.isArray(apt.providers) ? apt.providers[0] : apt.providers;
      const users = provider?.users ? (Array.isArray(provider.users) ? provider.users[0] : provider.users) : null;
      const providerEmail = users?.email || 'Provider';
      
      const room = Array.isArray(apt.practice_rooms) ? apt.practice_rooms[0] : apt.practice_rooms;
      const roomName = room?.name || 'No room';
      
      let description = `Type: ${apt.service_type || 'Appointment'}\\nProvider: ${providerEmail}\\nRoom: ${roomName}`;
      if (apt.notes) {
        description += `\\nNotes: ${escapeICSText(apt.notes)}`;
      }

      icalContent += `BEGIN:VEVENT
UID:appointment-${apt.id}@vitaluxe.com
DTSTART:${formatDateToICS(apt.start_time)}
DTEND:${formatDateToICS(apt.end_time)}
SUMMARY:${escapeICSText(`Patient: ${patientName}`)}
DESCRIPTION:${description}
LOCATION:${escapeICSText(roomName)}
STATUS:${apt.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}
SEQUENCE:0
END:VEVENT
`;
    }

    icalContent += 'END:VCALENDAR';

    console.log(`Calendar export generated for user ${user.id}, ${appointments?.length || 0} appointments`);

    return new Response(icalContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="vitaluxe-calendar.ics"',
      },
    });
  } catch (error) {
    console.error('Error exporting calendar:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
