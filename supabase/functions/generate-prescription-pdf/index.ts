import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import jsPDF from "https://esm.sh/jspdf@2.5.1";
import { validateGeneratePrescriptionRequest } from '../_shared/requestValidators.ts';

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

    // Parse and validate JSON
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validateGeneratePrescriptionRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      provider_id,
      patient_id,
      product_name,
      dosage,
      sig,
      patient_name,
      patient_dob,
      patient_age,
      patient_address,
      patient_sex,
      is_office_dispensing,
      provider_name,
      practice_name,
      practice_address,
      date,
      notes,
      quantity,
      signature,
      dispensing_option,
      refills_allowed = false,
      refills_total = 0
    } = requestData;

    // Normalize helper: convert falsy or [ENCRYPTED] to fallback
    const norm = (value: any, fallback: string): string => {
      if (!value || value === '[ENCRYPTED]' || value === 'null') return fallback;
      return String(value);
    };

    // Fetch provider credentials directly from profiles (no longer encrypted)
    const { data: providerRecord, error: providerError } = await supabase
      .from('providers')
      .select('user_id')
      .eq('id', provider_id)
      .single();

    if (providerError || !providerRecord) {
      console.error('Failed to fetch provider record:', providerError);
      throw new Error('Provider not found');
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('npi, dea, license_number')
      .eq('id', providerRecord.user_id)
      .single();

    console.log('Provider credentials response:', {
      profileError,
      hasData: !!profileData,
      rawData: profileData
    });

    if (profileError || !profileData) {
      console.error('Failed to fetch provider profile:', profileError);
      throw new Error('Failed to fetch provider credentials');
    }

    // Log raw values before normalization
    console.log('Provider credentials (raw):', {
      npi: profileData.npi,
      dea: profileData.dea,
      license_number: profileData.license_number,
      npi_type: typeof profileData.npi,
      dea_type: typeof profileData.dea,
      license_type: typeof profileData.license_number
    });

    // Use normalized values
    const provider_npi = norm(profileData.npi, 'N/A');
    const provider_dea = norm(profileData.dea, 'N/A');
    const provider_license = norm(profileData.license_number, 'N/A');

    console.log('Normalized provider credentials:', {
      npi: provider_npi,
      dea: provider_dea,
      license: provider_license
    });

    // Log if credentials are missing for debugging
    if (!profileData.npi || !profileData.dea || !profileData.license_number) {
      console.warn(`Provider ${provider_id} missing credentials:`, {
        npi: !!profileData.npi,
        dea: !!profileData.dea,
        license: !!profileData.license_number,
        provider_name
      });
    }

    // Fetch and decrypt patient allergies if patient_id is provided
    let patient_allergies = 'NKDA';
    if (patient_id && !is_office_dispensing) {
      const { data: patientData, error: patientError } = await supabase
        .rpc('get_decrypted_patient_phi', { p_patient_id: patient_id });
      
      if (!patientError && patientData && patientData.length > 0) {
        patient_allergies = norm(patientData[0].allergies, 'NKDA');
      }
    }

    console.log('Generating prescription PDF for:', product_name, 'with dispensing option:', dispensing_option);

    try {
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

    // Top credentials bar - compact single line with better spacing
    // Measure text widths to prevent overlap
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    
    const deaText = `DEA# ${provider_dea}`;
    const licenseText = `License # ${provider_license}`;
    const npiText = `NPI # ${provider_npi}`;
    
    const deaWidth = doc.getTextWidth(deaText);
    const licenseWidth = doc.getTextWidth(licenseText);
    
    // Position with proper spacing
    let xPos = 0.75;
    doc.text(deaText, xPos, 0.75);
    xPos += deaWidth + 0.3;
    
    // Adjust spacing if needed
    if (xPos + licenseWidth > 5.5) {
      xPos = 3.0;
    }
    doc.text(licenseText, xPos, 0.75);
    
    // NPI on the right
    doc.text(npiText, 6.0, 0.75);
    doc.line(0.5, 0.85, 8, 0.85); // Line below credentials

    // Provider/Practice info (centered)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(provider_name, 4.25, 1.2, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(practice_address, 4.25, 1.5, { align: 'center' });

    // Patient information section
    doc.setFontSize(11);
    const startY = 2.2;

    if (is_office_dispensing) {
      // Show "DISPENSING IN OFFICE ONLY" message
      doc.setFillColor(255, 255, 200); // Light yellow background
      doc.rect(0.75, startY - 0.2, 6.5, 1.0, 'FD');
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(139, 0, 0); // Dark red
      doc.text('DISPENSING IN OFFICE ONLY', 4, startY + 0.3, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('For practice use. Not for patient dispensing.', 4, startY + 0.6, { align: 'center' });
      
    } else {
      // Original patient info grid layout
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
    }

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Large Rx symbol
    const rxY = 4.0;
    doc.setFontSize(80);
    doc.setFont('times', 'bold');
    doc.setTextColor(139, 69, 19); // Brown color
    doc.text('Rx', 1.2, rxY);

    // Medication information (in bordered box)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    const medBoxY = rxY - 0.3;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.02);
    doc.rect(3, medBoxY, 4.5, 0.5, 'S'); // Medication box
    // Extract medication name without base dosage to avoid duplication
    const baseName = product_name.replace(/\s+\d+(\.\d+)?(mg|ml|g|mcg).*$/i, '').trim();
    doc.text(`${baseName} ${dosage || ''}`, 5.25, medBoxY + 0.35, { align: 'center' });

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
      doc.setFont('helvetica', 'italic'); // Cursive-like font
      doc.text(signature, 2, sigY);
    }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.02);
    doc.line(1.5, sigY + 0.2, 6.5, sigY + 0.2); // Signature line
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Prescriber Signature', 4, sigY + 0.45, { align: 'center' });

    // Bottom section
    const bottomY = 8.3;
    doc.line(0.5, bottomY, 8, bottomY); // Top line

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    
    // Refills section
    doc.text('Refills:', 1, bottomY + 0.25);
    doc.setFont('helvetica', 'normal');
    const refillText = refills_allowed ? `${refills_total} refill${refills_total !== 1 ? 's' : ''} authorized` : 'No refills';
    doc.text(refillText, 1.75, bottomY + 0.25);
    
    // Dispensing options
    doc.setFont('helvetica', 'bold');
    // Check "Dispense as Written" if selected
    doc.rect(1, bottomY + 0.5, 0.15, 0.15, dispensing_option === 'dispense_as_written' ? 'F' : 'S');
    doc.setFont('helvetica', 'normal');
    doc.text('Dispense as Written', 1.25, bottomY + 0.65);

    // Check "May Substitute" if selected
    doc.rect(4, bottomY + 0.5, 0.15, 0.15, dispensing_option === 'may_substitute' ? 'F' : 'S');
    doc.text('May Substitute', 4.25, bottomY + 0.65);

    // Footer note
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.line(0.5, bottomY + 0.95, 8, bottomY + 0.95);
    doc.text('This prescription was generated electronically on ' + date + '.', 4.25, bottomY + 1.15, { align: 'center' });
    doc.text('For pharmacy use only. Verify prescriber credentials before dispensing.', 4.25, bottomY + 1.35, { align: 'center' });

    // Get PDF as array buffer
    const pdfOutput = doc.output('arraybuffer');

    // Validate PDF output
    if (!pdfOutput || pdfOutput.byteLength === 0) {
      throw new Error('PDF generation failed - empty output');
    }

    console.log('PDF generated successfully, size:', pdfOutput.byteLength, 'bytes');

    // Prepare for upload
    const fileName = is_office_dispensing 
      ? `prescription_OFFICE_DISPENSING_${Date.now()}.pdf`
      : `prescription_${patient_name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
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

    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      throw new Error(`PDF generation failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('Error generating prescription:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An error occurred generating the prescription'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});