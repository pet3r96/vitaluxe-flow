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
        room:practice_rooms(name)
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

    // Get practice name and address
    const { data: practice } = await supabaseClient
      .from('profiles')
      .select('name, company, address_street, address_city, address_state, address_zip')
      .eq('id', practiceId)
      .single();

    const practiceName = practice?.company || practice?.name || 'Practice';
    const practiceAddress = [
      practice?.address_street,
      practice?.address_city,
      practice?.address_state,
      practice?.address_zip
    ].filter(Boolean).join(', ');

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
    
    if (practiceAddress) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(practiceAddress, 105, 27, { align: 'center' });
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Schedule', 105, 35, { align: 'center' });

    // Date and Provider info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const dateObj = new Date(date + 'T12:00:00Z');
    const dateStr = dateObj.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    doc.text(`Date: ${dateStr}`, 20, 47);
    doc.text(`Provider: ${providerName}`, 20, 54);

    // Separator line
    doc.setLineWidth(0.5);
    doc.line(20, 59, 190, 59);

    let yPosition = 70;

    // Generate hour-by-hour time slots from 8 AM to 6 PM
    const generateTimeSlots = () => {
      const slots = [];
      for (let hour = 8; hour <= 18; hour++) {
        slots.push({ hour, minute: 0 });
        if (hour < 18) {
          slots.push({ hour, minute: 30 });
        }
      }
      return slots;
    };

    const timeSlots = generateTimeSlots();
    
    // Map appointments to time slots (round down to nearest 30-minute slot)
    const appointmentsBySlot = new Map();
    if (appointments && appointments.length > 0) {
      for (const appt of appointments) {
        const typedAppt = appt as any;
        const startTime = new Date(typedAppt.start_time);
        const hour = startTime.getHours();
        const minute = startTime.getMinutes();
        
        // Round down to nearest 30-minute slot
        const slotMinute = minute < 30 ? 0 : 30;
        const slotKey = `${hour}-${slotMinute}`;
        
        if (!appointmentsBySlot.has(slotKey)) {
          appointmentsBySlot.set(slotKey, []);
        }
        appointmentsBySlot.get(slotKey).push(typedAppt);
      }
    }

    // Table header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const showProviderColumn = !providerId;
    const colWidths = showProviderColumn 
      ? { time: 25, patient: 45, service: 40, room: 25, provider: 35 }
      : { time: 30, patient: 60, service: 50, room: 30 };
    
    let xPos = 20;
    doc.text('Time', xPos, yPosition);
    xPos += colWidths.time;
    doc.text('Patient', xPos, yPosition);
    xPos += colWidths.patient;
    doc.text('Service', xPos, yPosition);
    xPos += colWidths.service;
    doc.text('Room', xPos, yPosition);
    if (showProviderColumn) {
      xPos += colWidths.room;
      doc.text('Provider', xPos, yPosition);
    }
    
    yPosition += 4;
    doc.setLineWidth(0.3);
    doc.line(20, yPosition, 190, yPosition);
    yPosition += 6;

    // Table rows
    doc.setFont('helvetica', 'normal');
    let totalShown = 0;
    
    for (const slot of timeSlots) {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
        
        // Repeat header on new page
        doc.setFont('helvetica', 'bold');
        xPos = 20;
        doc.text('Time', xPos, yPosition);
        xPos += colWidths.time;
        doc.text('Patient', xPos, yPosition);
        xPos += colWidths.patient;
        doc.text('Service', xPos, yPosition);
        xPos += colWidths.service;
        doc.text('Room', xPos, yPosition);
        if (showProviderColumn) {
          xPos += colWidths.room;
          doc.text('Provider', xPos, yPosition);
        }
        yPosition += 4;
        doc.line(20, yPosition, 190, yPosition);
        yPosition += 6;
        doc.setFont('helvetica', 'normal');
      }

      const slotKey = `${slot.hour}-${slot.minute}`;
      const slotAppointments = appointmentsBySlot.get(slotKey) || [];
      
      // Format time
      const timeStr = `${slot.hour > 12 ? slot.hour - 12 : slot.hour === 0 ? 12 : slot.hour}:${slot.minute.toString().padStart(2, '0')} ${slot.hour >= 12 ? 'PM' : 'AM'}`;
      
      if (slotAppointments.length === 0) {
        // Empty slot
        doc.setTextColor(180, 180, 180);
        xPos = 20;
        doc.text(timeStr, xPos, yPosition);
        xPos += colWidths.time;
        doc.text('-', xPos, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 6;
      } else {
        // Show appointments for this slot
        for (let i = 0; i < slotAppointments.length; i++) {
          const appt = slotAppointments[i];
          totalShown++;
          
          // Set color based on status
          if (appt.status === 'completed') {
            doc.setTextColor(120, 120, 120);
          } else if (appt.status === 'checked_in') {
            doc.setTextColor(0, 120, 0);
          } else if (appt.status === 'cancelled') {
            doc.setTextColor(200, 0, 0);
          } else {
            doc.setTextColor(0, 0, 0);
          }
          
          xPos = 20;
          
          // Time - show actual appointment start time
          const apptStartTime = new Date(appt.start_time);
          const apptHour = apptStartTime.getHours();
          const apptMinute = apptStartTime.getMinutes();
          const displayHour = apptHour > 12 ? apptHour - 12 : apptHour === 0 ? 12 : apptHour;
          const displayTimeStr = `${displayHour}:${apptMinute.toString().padStart(2, '0')} ${apptHour >= 12 ? 'PM' : 'AM'}`;
          doc.text(displayTimeStr, xPos, yPosition);
          xPos += colWidths.time;
          
          // Patient
          const patientName = `${appt.patient?.first_name || ''} ${appt.patient?.last_name || ''}`.trim() || 'Unknown';
          const truncatedPatient = patientName.length > 20 ? patientName.substring(0, 17) + '...' : patientName;
          doc.text(truncatedPatient, xPos, yPosition);
          xPos += colWidths.patient;
          
          // Service
          const serviceName = appt.service_type || 'N/A';
          const truncatedService = serviceName.length > 18 ? serviceName.substring(0, 15) + '...' : serviceName;
          doc.text(truncatedService, xPos, yPosition);
          xPos += colWidths.service;
          
          // Room
          const roomName = appt.room?.name || '-';
          doc.text(roomName, xPos, yPosition);
          
          // Provider (if showing all providers)
          if (showProviderColumn) {
            xPos += colWidths.room;
            const provName = appt.provider?.user?.name || '-';
            const truncatedProv = provName.length > 15 ? provName.substring(0, 12) + '...' : provName;
            doc.text(truncatedProv, xPos, yPosition);
          }
          
          yPosition += 6;
        }
      }
    }
    
    doc.setTextColor(0, 0, 0);

    // Footer with summary
    yPosition += 5;
    doc.setLineWidth(0.5);
    doc.line(20, yPosition, 190, yPosition);
    yPosition += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Appointments: ${appointments?.length || 0}`, 20, yPosition);
    
    // Status breakdown
    if (appointments && appointments.length > 0) {
      const statusCounts = (appointments as any[]).reduce((acc, appt) => {
        acc[appt.status] = (acc[appt.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      yPosition += 6;
      doc.setFont('helvetica', 'normal');
      const statusStr = Object.entries(statusCounts)
        .map(([status, count]) => `${status}: ${count}`)
        .join(' | ');
      doc.text(statusStr, 20, yPosition);
    }
    
    yPosition += 6;
    doc.setFont('helvetica', 'italic');
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
