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
          practice_npi
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError) throw orderError;

    // Fetch order lines
    const { data: lines, error: linesError } = await supabase
      .from('order_lines')
      .select(`
        *,
        products (
          name
        )
      `)
      .eq('order_id', order_id);

    if (linesError) throw linesError;

    // Import jsPDF dynamically
    const { default: jsPDF } = await import('https://cdn.skypack.dev/jspdf@2.5.1');

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
    yPos += 8;

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
