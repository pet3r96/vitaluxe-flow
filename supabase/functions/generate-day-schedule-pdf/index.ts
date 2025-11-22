import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { edgeLogger } from '../_shared/logger.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Not authenticated');
    }

    const { practiceId, date, providerId } = await req.json();

    if (!practiceId || !date) {
      throw new Error('practiceId and date are required');
    }

    const { edgeLogger } = await import('../_shared/logger.ts');
    edgeLogger.info('[Print Day] Request received', { userId: user.id, practiceId, date, providerId: providerId || 'all' });

    // Check user roles using roleChecker
    const { getUserRoles, isAdmin: checkAdmin } = await import('../_shared/roleChecker.ts');
    const userRoles = await getUserRoles(supabaseClient, user.id);
    const isAdmin = await checkAdmin(supabaseClient, user.id);
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

    edgeLogger.info('[Print Day] User authorized', { isAdmin, isPractice, isStaff, isProvider });

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
        visit_type,
        video_session_id,
        patient:patient_accounts(first_name, last_name),
        provider:providers!patient_appointments_provider_id_fkey(
          id,
          user:profiles!providers_user_id_fkey(name, full_name)
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
      edgeLogger.error('[Print Day] Error fetching appointments', appointmentsError);
      throw appointmentsError;
    }

    edgeLogger.info('[Print Day] Found appointments', { count: appointments?.length || 0 });

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

    // Generate time slots dynamically based on appointments or default to 7 AM - 7 PM
    const generateTimeSlots = () => {
      const slots = [];
      let startHour = 7;
      let endHour = 19;
      
      // If we have appointments, expand range to cover them
      if (appointments && appointments.length > 0) {
        const times = appointments.map((appt: any) => new Date(appt.start_time).getHours());
        const minHour = Math.min(...times);
        const maxHour = Math.max(...times);
        startHour = Math.max(0, minHour - 1); // Start 1 hour before earliest
        endHour = Math.min(23, maxHour + 2); // End 2 hours after latest
      }
      
      for (let hour = startHour; hour <= endHour; hour++) {
        slots.push({ hour, minute: 0 });
        if (hour < endHour) {
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
          
          // Service - show type based on visit_type and service_description
          let serviceName = 'N/A';
          if (appt.video_session_id || appt.visit_type === 'video') {
            serviceName = 'Video Consultation';
          } else if (appt.service_description) {
            serviceName = appt.service_description;
          } else if (appt.visit_type === 'in_person') {
            serviceName = 'Office Visit';
          } else if (appt.service_type && !appt.service_type.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            // Only show service_type if it's not a UUID
            serviceName = appt.service_type;
          }
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

    edgeLogger.info('[Print Day] PDF generated successfully', { size: pdfBase64.length });

    return new Response(
      JSON.stringify({
        success: true,
        pdf: pdfBase64,
        appointmentCount: appointments?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    edgeLogger.error('[Print Day] Error', error);
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
