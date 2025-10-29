import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
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

    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Not authenticated');
    }

    const { practiceId, date, providerId } = await req.json();

    if (!practiceId || !date) {
      throw new Error('practiceId and date are required');
    }

    console.log(`[Print Day] Request from user ${user.id} for practice ${practiceId}, date ${date}, provider ${providerId || 'all'}`);

    // Check user roles
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const userRoles = roles?.map((r: any) => r.role) || [];
    const isAdmin = userRoles.includes('admin');
    const isPractice = user.id === practiceId;

    // Check if staff
    const { data: staffRecord } = await supabaseClient
      .from('practice_staff')
      .select('id, can_order')
      .eq('user_id', user.id)
      .eq('practice_id', practiceId)
      .eq('active', true)
      .maybeSingle();

    const isStaff = !!staffRecord;

    // Check if provider
    const { data: providerRecord } = await supabaseClient
      .from('providers')
      .select('id')
      .eq('user_id', user.id)
      .eq('practice_id', practiceId)
      .maybeSingle();

    const isProvider = !!providerRecord;

    // Permission check: Providers can only view their own schedule
    if (isProvider && !isPractice && !isStaff && !isAdmin) {
      if (!providerId || providerId !== providerRecord.id) {
        throw new Error('Providers can only print their own schedule');
      }
    }

    // Must have some permission
    if (!isAdmin && !isPractice && !isStaff && !isProvider) {
      throw new Error('Insufficient permissions to print schedule');
    }

    console.log(`[Print Day] User authorized: admin=${isAdmin}, practice=${isPractice}, staff=${isStaff}, provider=${isProvider}`);

    // Query appointments for the day
    const startOfDay = `${date}T00:00:00Z`;
    const endOfDay = `${date}T23:59:59Z`;

    let query = supabaseClient
      .from('patient_appointments')
      .select(`
        id,
        start_time,
        end_time,
        appointment_type,
        status,
        notes,
        service_type,
        service_description,
        patient:patient_accounts(first_name, last_name),
        provider:providers!patient_appointments_provider_id_fkey(
          id,
          user:profiles(name)
        ),
        room:practice_rooms(name),
        service_type_info:appointment_service_types(name)
      `)
      .eq('practice_id', practiceId)
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)
      .order('start_time', { ascending: true });

    // Apply provider filter if specified
    if (providerId) {
      query = query.eq('provider_id', providerId);
    }

    const { data: appointments, error: appointmentsError } = await query;
    
    if (appointmentsError) {
      console.error('[Print Day] Error fetching appointments:', appointmentsError);
      throw appointmentsError;
    }

    console.log(`[Print Day] Found ${appointments?.length || 0} appointments`);

    // Get practice name
    const { data: practice } = await supabaseClient
      .from('profiles')
      .select('name, company')
      .eq('id', practiceId)
      .single();

    const practiceName = practice?.company || practice?.name || 'Practice';

    // Get provider name if filtering by provider
    let providerName = 'All Providers';
    if (providerId && appointments && appointments.length > 0) {
      const firstAppt = appointments[0] as any;
      providerName = firstAppt?.provider?.user?.name || 'Unknown Provider';
    }

    // Generate PDF using jsPDF
    const jsPDF = (await import('https://esm.sh/jspdf@2.5.1')).default;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(practiceName, 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Daily Schedule', 105, 28, { align: 'center' });

    // Date and Provider info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const dateObj = new Date(date + 'T12:00:00Z'); // Noon to avoid timezone issues
    const dateStr = dateObj.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    doc.text(`Date: ${dateStr}`, 20, 40);
    doc.text(`Provider: ${providerName}`, 20, 47);

    // Separator line
    doc.setLineWidth(0.5);
    doc.line(20, 52, 190, 52);

    let yPosition = 60;

    if (!appointments || appointments.length === 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'italic');
      doc.text('No appointments scheduled for this day.', 105, yPosition, { align: 'center' });
    } else {
      // Loop through appointments
      for (const appt of appointments) {
        const typedAppt = appt as any;
        
        // Check if we need a new page
        if (yPosition > 260) {
          doc.addPage();
          yPosition = 20;
        }

        // Time
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        const startTime = new Date(typedAppt.start_time);
        const endTime = new Date(typedAppt.end_time);
        const timeStr = `${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        doc.text(timeStr, 20, yPosition);

        // Patient Name
        yPosition += 7;
        doc.setFontSize(11);
        const patientName = `${typedAppt.patient?.first_name || ''} ${typedAppt.patient?.last_name || ''}`.trim() || 'Unknown Patient';
        doc.text(`Patient: ${patientName}`, 25, yPosition);

        // Service Type
        if (typedAppt.service_type) {
          yPosition += 6;
          doc.setFont('helvetica', 'normal');
          const serviceName = typedAppt.service_type_info?.name || typedAppt.service_type;
          doc.text(`Service: ${serviceName}`, 25, yPosition);
        }

        // Service Description
        if (typedAppt.service_description && typedAppt.service_description.trim() !== '') {
          yPosition += 6;
          const descLines = doc.splitTextToSize(`Description: ${typedAppt.service_description}`, 160);
          doc.text(descLines, 25, yPosition);
          yPosition += (descLines.length - 1) * 6;
        }

        // Appointment Type & Room
        yPosition += 6;
        let detailsLine = `Type: ${typedAppt.appointment_type || 'N/A'}`;
        if (typedAppt.room?.name) {
          detailsLine += ` | Room: ${typedAppt.room.name}`;
        }
        doc.text(detailsLine, 25, yPosition);

        // Status
        yPosition += 6;
        const statusMap: Record<string, string> = {
          'scheduled': 'Scheduled',
          'confirmed': 'Confirmed',
          'checked_in': 'Checked In',
          'in_progress': 'In Progress',
          'completed': 'Completed',
          'cancelled': 'Cancelled',
          'no_show': 'No Show',
          'rescheduled': 'Rescheduled'
        };
        const statusText = statusMap[typedAppt.status] || typedAppt.status;
        doc.text(`Status: ${statusText}`, 25, yPosition);

        // Notes
        if (typedAppt.notes && typedAppt.notes.trim() !== '') {
          yPosition += 6;
          const notesLines = doc.splitTextToSize(`Notes: ${typedAppt.notes}`, 160);
          doc.text(notesLines, 25, yPosition);
          yPosition += (notesLines.length - 1) * 6;
        }

        // Separator
        yPosition += 8;
        doc.setLineWidth(0.3);
        doc.line(20, yPosition, 190, yPosition);
        yPosition += 8;
      }
    }

    // Footer
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(`Total Appointments: ${appointments?.length || 0}`, 20, yPosition);
    yPosition += 6;
    const generatedTime = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    doc.text(`Generated: ${generatedTime}`, 20, yPosition);

    // Convert to base64
    const pdfOutput = doc.output('arraybuffer');
    const pdfBase64 = btoa(
      new Uint8Array(pdfOutput).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    console.log(`[Print Day] PDF generated successfully, size: ${pdfBase64.length} bytes`);

    return new Response(
      JSON.stringify({
        success: true,
        pdf: pdfBase64,
        appointmentCount: appointments?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Print Day] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate schedule PDF'
      }),
      { 
        status: error instanceof Error && error.message.includes('authenticated') ? 401 : 
                error instanceof Error && error.message.includes('permission') ? 403 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
