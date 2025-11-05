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
        practice_id,
        service_type,
        status,
        notes,
        patient_accounts!patient_appointments_patient_id_fkey (
          first_name,
          last_name
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

    // Fetch provider information separately
    const providerIds = [...new Set(appointments?.map(apt => apt.provider_id).filter(Boolean) || [])];
    let providerMap = new Map();
    
    if (providerIds.length > 0) {
      const { data: providers } = await supabaseClient
        .from('providers')
        .select('id, user_id, first_name, last_name')
        .in('id', providerIds);
      
      if (providers) {
        for (const provider of providers) {
          const displayName = `${provider.first_name || ''} ${provider.last_name || ''}`.trim() || 'Provider';
          providerMap.set(provider.id, displayName);
        }
      }
    }

    // Fetch practice information to get addresses
    const practiceIds = [...new Set(appointments?.map(apt => apt.practice_id).filter(Boolean) || [])];
    let practiceMap = new Map();
    
    console.log(`Found ${practiceIds.length} unique practice IDs to fetch addresses for`);
    
    if (practiceIds.length > 0) {
      const { data: practices, error: practiceError } = await supabaseClient
        .from('practices')
        .select('id, address_line1, address_line2, city, state, zip_code')
        .in('id', practiceIds);
      
      if (practiceError) {
        console.error('Error fetching practice addresses:', practiceError);
      }
      
      if (practices) {
        console.log(`Successfully fetched ${practices.length} practice addresses`);
        for (const practice of practices) {
          const addressParts = [];
          if (practice.address_line1) addressParts.push(practice.address_line1);
          if (practice.address_line2) addressParts.push(practice.address_line2);
          if (practice.city) addressParts.push(practice.city);
          if (practice.state) addressParts.push(practice.state);
          if (practice.zip_code) addressParts.push(practice.zip_code);
          
          const fullAddress = addressParts.join(', ');
          practiceMap.set(practice.id, fullAddress);
          console.log(`Practice ${practice.id} address: ${fullAddress}`);
        }
      }
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
      
      const providerName = apt.provider_id ? providerMap.get(apt.provider_id) || 'Provider' : 'Provider';
      
      const room = Array.isArray(apt.practice_rooms) ? apt.practice_rooms[0] : apt.practice_rooms;
      const roomName = room?.name || 'No room';
      
      // Get practice address with validation
      let practiceAddress = '';
      if (apt.practice_id) {
        practiceAddress = practiceMap.get(apt.practice_id) || '';
        if (!practiceAddress) {
          console.warn(`Appointment ${apt.id}: practice_id ${apt.practice_id} found but no address in map`);
        }
      } else {
        console.warn(`Appointment ${apt.id}: Missing practice_id`);
      }
      
      const location = practiceAddress ? `${roomName}, ${practiceAddress}` : roomName;
      
      let description = `Type: ${apt.service_type || 'Appointment'}\\nProvider: ${providerName}\\nRoom: ${roomName}`;
      if (apt.notes) {
        description += `\\nNotes: ${escapeICSText(apt.notes)}`;
      }

      icalContent += `BEGIN:VEVENT
UID:appointment-${apt.id}@vitaluxe.com
DTSTART:${formatDateToICS(apt.start_time)}
DTEND:${formatDateToICS(apt.end_time)}
SUMMARY:${escapeICSText(`Patient: ${patientName}`)}
DESCRIPTION:${description}
LOCATION:${escapeICSText(location)}
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
