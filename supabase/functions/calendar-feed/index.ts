import { createAdminClient } from '../_shared/supabaseAdmin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Missing token parameter', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    // Validate token and get user
    const { data: tokenData, error: tokenError } = await supabase
      .from('calendar_sync_tokens')
      .select('user_id, is_active, expires_at')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData || !tokenData.is_active) {
      console.error('Invalid token:', tokenError);
      return new Response('Invalid or inactive token', {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    // Check expiration
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response('Token expired', {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    // Update last_accessed_at
    await supabase
      .from('calendar_sync_tokens')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('token', token);

    // Get user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', tokenData.user_id)
      .single();

    const userRole = roleData?.role || 'doctor';

    // Determine practice context
    let practiceId: string | null = null;
    let providerId: string | null = null;

    if (userRole === 'doctor') {
      practiceId = tokenData.user_id;
    } else if (userRole === 'provider') {
      const { data: providerData } = await supabase
        .from('providers')
        .select('id, practice_id')
        .eq('user_id', tokenData.user_id)
        .single();
      
      if (providerData) {
        providerId = providerData.id;
        practiceId = providerData.practice_id;
      }
    } else if (userRole === 'staff') {
      const { data: staffData } = await supabase
        .from('practice_staff')
        .select('practice_id')
        .eq('user_id', tokenData.user_id)
        .single();
      
      if (staffData) {
        practiceId = staffData.practice_id;
      }
    }

    // Fetch appointments based on role
    let query = supabase
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
        patients!patient_appointments_patient_id_fkey (
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
      .gte('start_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .lte('start_time', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()) // Next 365 days
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true });

    // Apply role-based filtering
    if (userRole === 'provider' && providerId) {
      query = query.eq('provider_id', providerId);
    } else if (practiceId) {
      query = query.eq('practice_id', practiceId);
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
X-WR-CALNAME:VitaLuxe Practice Calendar
X-WR-TIMEZONE:America/New_York
`;

    for (const apt of appointments || []) {
      const patient = Array.isArray(apt.patients) ? apt.patients[0] : apt.patients;
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

    console.log(`Calendar feed generated for user ${tokenData.user_id}, ${appointments?.length || 0} appointments`);

    return new Response(icalContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="calendar.ics"',
      },
    });
  } catch (error) {
    console.error('Error generating calendar feed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(`Error: ${errorMessage}`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }
});
