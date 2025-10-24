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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Fetch pharmacy info
    const { data: pharmacy, error: pharmacyError } = await supabase
      .from('pharmacies')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (pharmacyError) throw pharmacyError;

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        profiles (
          name,
          company,
          address_street,
          address_city,
          address_state,
          address_zip,
          shipping_address_street,
          shipping_address_city,
          shipping_address_state,
          shipping_address_zip
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError) throw orderError;

    // Fetch first order line to get patient address if needed
    const { data: firstLine, error: lineError } = await supabase
      .from('order_lines')
      .select('patient_address, patient_address_encrypted')
      .eq('order_id', order_id)
      .limit(1)
      .single();

    if (lineError) throw lineError;

    // Determine destination address
    let destStreet, destCity, destState, destZip, destName;

    if (order.ship_to === 'practice') {
      // Use practice shipping address or billing address
      destStreet = order.profiles?.shipping_address_street || order.profiles?.address_street;
      destCity = order.profiles?.shipping_address_city || order.profiles?.address_city;
      destState = order.profiles?.shipping_address_state || order.profiles?.address_state;
      destZip = order.profiles?.shipping_address_zip || order.profiles?.address_zip;
      destName = order.profiles?.company || order.profiles?.name;
    } else {
      // Use patient address
      if (firstLine.patient_address_encrypted) {
        // Decrypt patient address
        const { data: decrypted, error: decryptError } = await supabase.rpc(
          'decrypt_order_line_contact',
          {
            p_encrypted_data: firstLine.patient_address_encrypted,
            p_field_type: 'address'
          }
        );

        if (decryptError) throw decryptError;

        const addressParts = decrypted?.split(',').map((s: string) => s.trim());
        if (addressParts && addressParts.length >= 3) {
          destStreet = addressParts[0];
          destCity = addressParts[1];
          const stateZip = addressParts[2].split(' ');
          destState = stateZip[0];
          destZip = stateZip[1];
        } else {
          destStreet = decrypted;
          destCity = '';
          destState = '';
          destZip = '';
        }
      } else {
        destStreet = firstLine.patient_address || '';
        destCity = '';
        destState = '';
        destZip = '';
      }
      destName = 'Patient';
    }

    // Import jsPDF
    const { default: jsPDF } = await import('https://cdn.skypack.dev/jspdf@2.5.1');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let yPos = 20;

    // Title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('SHIPPING LABEL', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Order number barcode area (simulated with text)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Order: ${order.order_number || order_id.slice(0, 8)}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Shipping speed badge
    doc.setFillColor(59, 130, 246);
    doc.rect(pageWidth / 2 - 30, yPos, 60, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(order.shipping_speed.toUpperCase(), pageWidth / 2, yPos + 7, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    yPos += 20;

    // FROM section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('FROM:', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(pharmacy.name, 20, yPos);
    yPos += 6;
    if (pharmacy.address) {
      const addressLines = doc.splitTextToSize(pharmacy.address, pageWidth - 40);
      addressLines.forEach((line: string) => {
        doc.text(line, 20, yPos);
        yPos += 6;
      });
    }
    yPos += 10;

    // TO section (larger, prominent)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TO:', 20, yPos);
    yPos += 10;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(destName || 'Recipient', 20, yPos);
    yPos += 8;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    if (destStreet) {
      doc.text(destStreet, 20, yPos);
      yPos += 7;
    }
    if (destCity && destState && destZip) {
      doc.text(`${destCity}, ${destState} ${destZip}`, 20, yPos);
      yPos += 7;
    } else if (destCity) {
      doc.text(destCity, 20, yPos);
      yPos += 7;
    }

    // Large border box around TO address
    doc.setLineWidth(2);
    doc.rect(15, yPos - 45, pageWidth - 30, 50);

    yPos += 20;

    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 280);

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
    console.error('Error generating shipping label:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
