import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import jsPDF from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      product_name,
      dosage,
      sig,
      patient_name,
      patient_dob,
      patient_age,
      patient_address,
      patient_allergies,
      patient_sex,
      provider_name,
      provider_npi,
      provider_dea,
      provider_license,
      practice_name,
      practice_address,
      date,
      notes,
      quantity,
      signature,
      dispensing_option
    } = await req.json();

    console.log('Generating prescription PDF for:', product_name, 'with dispensing option:', dispensing_option);

    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'letter'
    });

    // Set beige/cream background (like prescription pad)
    doc.setFillColor(245, 245, 220);
    doc.rect(0, 0, 8.5, 11, 'F');

    // Add border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.02);
    doc.rect(0.5, 0.5, 7.5, 10, 'S');

    // Top credentials bar
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`DEA# ${provider_dea || 'N/A'}`, 1.5, 0.75);
    doc.text(`License # ${provider_license || 'N/A'}`, 4.25, 0.75);
    doc.text(`NPI # ${provider_npi}`, 7, 0.75);
    doc.line(0.5, 0.85, 8, 0.85); // Line below credentials

    // Provider/Practice info (centered)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(provider_name, 4.25, 1.2, { align: 'center' });
    doc.text(practice_name, 4.25, 1.5, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(practice_address, 4.25, 1.75, { align: 'center' });

    // Patient information section (grid layout)
    doc.setFontSize(11);
    const startY = 2.2;
    
    // Row 1
    doc.setFont('helvetica', 'bold');
    doc.text('Name:', 0.75, startY);
    doc.setFont('helvetica', 'normal');
    doc.text(patient_name, 1.5, startY);
    
    doc.setFont('helvetica', 'bold');
    doc.text('DOB:', 4.5, startY);
    doc.setFont('helvetica', 'normal');
    doc.text(patient_dob || 'N/A', 5.2, startY);

    // Row 2
    doc.setFont('helvetica', 'bold');
    doc.text('Address:', 0.75, startY + 0.3);
    doc.setFont('helvetica', 'normal');
    doc.text(patient_address || 'N/A', 1.5, startY + 0.3, { maxWidth: 2.5 });
    
    doc.setFont('helvetica', 'bold');
    doc.text('Age:', 4.5, startY + 0.3);
    doc.setFont('helvetica', 'normal');
    doc.text(patient_age?.toString() || 'N/A', 5.2, startY + 0.3);

    // Row 3
    doc.setFont('helvetica', 'bold');
    doc.text('Allergies:', 0.75, startY + 0.6);
    doc.setFont('helvetica', 'normal');
    doc.text(patient_allergies || 'NKDA', 1.5, startY + 0.6);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Sex:', 4.5, startY + 0.6);
    doc.setFont('helvetica', 'normal');
    doc.text(patient_sex || 'N/A', 5.2, startY + 0.6);

    // Row 4
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', 0.75, startY + 0.9);
    doc.setFont('helvetica', 'normal');
    doc.text(date, 1.5, startY + 0.9);

    // Large Rx symbol
    const rxY = 4.0;
    doc.setFontSize(80);
    doc.setFont('times', 'bold');
    doc.setTextColor(139, 69, 19); // Brown color
    doc.text('℞', 1.2, rxY);

    // Medication information (in bordered box)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    const medBoxY = rxY - 0.3;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.02);
    doc.rect(3, medBoxY, 4.5, 0.5, 'S'); // Medication box
    doc.text(`${product_name} ${dosage || ''}`, 5.25, medBoxY + 0.35, { align: 'center' });

    // Medication details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const detailsY = medBoxY + 0.8;
    doc.setFont('helvetica', 'bold');
    doc.text('Sig:', 3, detailsY);
    doc.setFont('helvetica', 'normal');
    doc.text(sig || 'As directed by prescriber', 3.5, detailsY, { maxWidth: 4 });

    doc.setFont('helvetica', 'bold');
    doc.text('Quantity:', 3, detailsY + 0.3);
    doc.setFont('helvetica', 'normal');
    doc.text(quantity?.toString() || '1', 3.8, detailsY + 0.3);

    if (notes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', 3, detailsY + 0.6);
      doc.setFont('helvetica', 'normal');
      doc.text(notes, 3.5, detailsY + 0.6, { maxWidth: 4 });
    }

    // Signature section
    const sigY = 7.5;
    if (signature) {
      doc.setFontSize(20);
      doc.setFont('courier', 'italic'); // Cursive-like font
      doc.text(signature, 2, sigY);
    }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.02);
    doc.line(1.5, sigY + 0.2, 6.5, sigY + 0.2); // Signature line
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Prescriber Signature', 4, sigY + 0.45, { align: 'center' });

    // Bottom section
    const bottomY = 8.5;
    doc.line(0.5, bottomY, 8, bottomY); // Top line

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    
    // Check "Dispense as Written" if selected
    doc.rect(1, bottomY + 0.15, 0.15, 0.15, dispensing_option === 'dispense_as_written' ? 'F' : 'S');
    doc.setFont('helvetica', 'normal');
    doc.text('Dispense as Written', 1.25, bottomY + 0.3);

    // Check "May Substitute" if selected
    doc.rect(4, bottomY + 0.15, 0.15, 0.15, dispensing_option === 'may_substitute' ? 'F' : 'S');
    doc.text('May Substitute', 4.25, bottomY + 0.3);

    // Footer note
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.line(0.5, bottomY + 0.6, 8, bottomY + 0.6);
    doc.text('This prescription was generated electronically on ' + date + '.', 4.25, bottomY + 0.8, { align: 'center' });
    doc.text('For pharmacy use only. Verify prescriber credentials before dispensing.', 4.25, bottomY + 1, { align: 'center' });

    // Get PDF as array buffer
    const pdfOutput = doc.output('arraybuffer');

    // Prepare for upload
    const fileName = `prescription_${patient_name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    const prescriptionData = new Uint8Array(pdfOutput);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('prescriptions')
      .upload(fileName, prescriptionData, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload prescription: ${uploadError.message}`);
    }

    // Get signed URL
    const { data: signedUrlData } = await supabase.storage
      .from('prescriptions')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year expiry

    console.log('Prescription generated successfully:', fileName);

    return new Response(
      JSON.stringify({
        success: true,
        prescription_url: signedUrlData?.signedUrl || uploadData.path,
        file_name: fileName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error generating prescription:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});