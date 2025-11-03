import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id } = await req.json();

    if (!order_id) {
      throw new Error('order_id is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        profiles (
          name,
          company,
          npi,
          practice_npi,
          address_street,
          address_city,
          address_state,
          address_zip
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError) throw orderError;

    // Fetch order lines with provider info
    const { data: lines, error: linesError } = await supabase
      .from('order_lines')
      .select(`
        *,
        products (
          name
        ),
        providers (
          id,
          profiles!providers_user_id_fkey (
            full_name,
            name,
            email,
            npi
          )
        )
      `)
      .eq('order_id', order_id);

    if (linesError) throw linesError;

    // Fetch patient addresses if shipping to patient
    const patientAddresses = new Map();
    if (order.ship_to === 'patient' && lines && lines.length > 0) {
      const patientIds = [...new Set(lines.map(l => l.patient_id).filter(Boolean))];
      
      for (const patientId of patientIds) {
        try {
          const { data: contactData } = await supabase.rpc('get_decrypted_patient_phi', {
            p_patient_id: patientId
          });
          
          if (contactData && contactData.length > 0 && contactData[0].address) {
            patientAddresses.set(patientId, contactData[0].address);
          } else {
            // Fallback to plain text
            const { data: patientData } = await supabase
              .from('patient_accounts')
              .select('address')
              .eq('id', patientId)
              .single();
            
            if (patientData?.address && patientData.address !== '[ENCRYPTED]') {
              patientAddresses.set(patientId, patientData.address);
            }
          }
        } catch (error) {
          console.error(`Failed to fetch address for patient ${patientId}:`, error);
        }
      }
    }

    // Import jsPDF dynamically
    const { default: jsPDF } = await import('https://esm.sh/jspdf@2.5.2');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let yPos = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Order Summary - Pharmacy Copy', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('(No Pricing Information)', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Order Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Order Information', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Order Number: ${order.order_number || order_id.slice(0, 8)}`, 20, yPos);
    yPos += 6;
    doc.text(`Order Date: ${new Date(order.created_at).toLocaleDateString()}`, 20, yPos);
    yPos += 6;
    doc.text(`Shipping Speed: ${order.shipping_speed}`, 20, yPos);
    yPos += 6;
    doc.text(`Ship To: ${order.ship_to === 'practice' ? 'Practice' : 'Patient'}`, 20, yPos);
    yPos += 12;

    // Practice Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Practice Information', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Practice: ${order.profiles?.company || order.profiles?.name || 'N/A'}`, 20, yPos);
    yPos += 6;
    if (order.profiles?.npi) {
      doc.text(`NPI: ${order.profiles.npi}`, 20, yPos);
      yPos += 6;
    }
    if (order.profiles?.practice_npi) {
      doc.text(`Practice NPI: ${order.profiles.practice_npi}`, 20, yPos);
      yPos += 6;
    }
    
    // Practice Address
    if (order.profiles?.address_street && order.profiles?.address_city) {
      const addressLine = `Address: ${order.profiles.address_street}, ${order.profiles.address_city}, ${order.profiles.address_state || ''} ${order.profiles.address_zip || ''}`;
      const addressLines = doc.splitTextToSize(addressLine, pageWidth - 40);
      doc.text(addressLines, 20, yPos);
      yPos += (addressLines.length * 6);
    }
    yPos += 8;

    // Shipping Address
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Shipping Address', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (order.ship_to === 'practice') {
      if (order.profiles?.address_street && order.profiles?.address_city) {
        const addressLine = `${order.profiles.address_street}, ${order.profiles.address_city}, ${order.profiles.address_state || ''} ${order.profiles.address_zip || ''}`;
        const addressLines = doc.splitTextToSize(addressLine, pageWidth - 40);
        doc.text(addressLines, 20, yPos);
        yPos += (addressLines.length * 6);
      } else {
        doc.text('Practice address not available', 20, yPos);
        yPos += 6;
      }
    } else {
      // Patient addresses
      const uniquePatientIds = [...new Set(lines.map(l => l.patient_id).filter(Boolean))];
      if (uniquePatientIds.length > 0) {
        uniquePatientIds.forEach((patientId, idx) => {
          const line = lines.find(l => l.patient_id === patientId);
          const address = patientAddresses.get(patientId);
          
          if (line) {
            doc.setFont('helvetica', 'bold');
            doc.text(`Patient: ${line.patient_name}`, 20, yPos);
            yPos += 6;
            
            doc.setFont('helvetica', 'normal');
            if (address) {
              const addressLines = doc.splitTextToSize(address, pageWidth - 40);
              doc.text(addressLines, 20, yPos);
              yPos += (addressLines.length * 6);
            } else {
              doc.text('Address not available', 20, yPos);
              yPos += 6;
            }
            yPos += 4;
          }
        });
      } else {
        doc.text('Patient address not available', 20, yPos);
        yPos += 6;
      }
    }
    yPos += 8;

    // Prescriber Information
    const uniqueProviders = new Map();
    lines.forEach(line => {
      if (line.providers && line.providers.id) {
        uniqueProviders.set(line.providers.id, line.providers);
      }
    });

    if (uniqueProviders.size > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Prescriber Information', 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      uniqueProviders.forEach((provider) => {
        const profile = provider.profiles;
        doc.setFont('helvetica', 'bold');
        doc.text(`Prescriber: ${profile?.full_name || profile?.name || 'Provider'}`, 20, yPos);
        yPos += 6;
        
        doc.setFont('helvetica', 'normal');
        if (profile?.npi) {
          doc.text(`NPI: ${profile.npi}`, 20, yPos);
          yPos += 6;
        }
        if (profile?.email) {
          doc.text(`Email: ${profile.email}`, 20, yPos);
          yPos += 6;
        }
        yPos += 4;
      });
      yPos += 8;
    }

    // Order Lines
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Order Items', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    lines.forEach((line: any, index: number) => {
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${line.products?.name || 'Product'}`, 20, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      doc.text(`   Patient: ${line.patient_name}`, 20, yPos);
      yPos += 6;
      doc.text(`   Quantity: ${line.quantity}`, 20, yPos);
      yPos += 6;

      if (line.custom_dosage) {
        doc.text(`   Dosage: ${line.custom_dosage}`, 20, yPos);
        yPos += 6;
      }

      if (line.custom_sig) {
        doc.text(`   Instructions: ${line.custom_sig}`, 20, yPos);
        yPos += 6;
      }

      if (line.order_notes) {
        const notes = doc.splitTextToSize(`   Notes: ${line.order_notes}`, pageWidth - 40);
        doc.text(notes, 20, yPos);
        yPos += (notes.length * 6);
      }

      yPos += 4;
    });

    // Footer
    yPos += 10;
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('This is a pharmacy copy. Pricing information has been excluded.', 20, yPos);
    yPos += 5;
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPos);

    // Generate PDF as base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];

    return new Response(
      JSON.stringify({ pdf: pdfBase64 }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error generating pharmacy order summary:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
