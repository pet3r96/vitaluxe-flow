import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import jsPDF from "https://esm.sh/jspdf@2.5.1";
import { validateGeneratePrescriptionRequest } from '../_shared/requestValidators.ts';
import { handleError, createErrorResponse } from '../_shared/errorHandler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createAdminClient();
  let requestData: any;

  try {
    // Parse and validate JSON
    try {
      requestData = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let prescriptionData;

    // Check if order_line_id is provided (new mode)
    if (requestData.order_line_id) {
      console.log('Fetching prescription data from order_line_id:', requestData.order_line_id);
      
      // Fetch order line
      const { data: orderLine, error: lineError } = await supabase
        .from('order_lines')
        .select('*, orders!inner(created_at, ship_to)')
        .eq('id', requestData.order_line_id)
        .single();

      if (lineError || !orderLine) {
        console.error('Error fetching order line:', lineError);
        return new Response(
          JSON.stringify({ error: 'Order line not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch product name
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('name')
        .eq('id', orderLine.product_id)
        .single();

      if (productError || !product) {
        console.error('Error fetching product:', productError);
        return new Response(
          JSON.stringify({ error: 'Product not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch provider profile via providers table
      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('user_id')
        .eq('id', orderLine.provider_id)
        .single();

      if (providerError || !provider) {
        console.error('Error fetching provider:', providerError);
        return new Response(
          JSON.stringify({ error: 'Provider not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch provider profile for name and credentials
      const { data: providerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('name, company, address_street, address_city, address_state, address_zip')
        .eq('id', provider.user_id)
        .single();

      if (profileError || !providerProfile) {
        console.error('Error fetching provider profile:', profileError);
        return new Response(
          JSON.stringify({ error: 'Provider profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build prescription data object
      prescriptionData = {
        provider_id: orderLine.provider_id,
        patient_id: orderLine.patient_id,
        product_name: product.name,
        dosage: orderLine.custom_dosage || '',
        sig: orderLine.custom_sig || '',
        patient_name: orderLine.patient_name,
        patient_address: orderLine.patient_address,
        provider_name: providerProfile.name || 'Provider',
        practice_name: providerProfile.company || null,
        practice_address: providerProfile.address_street 
          ? `${providerProfile.address_street}, ${providerProfile.address_city}, ${providerProfile.address_state} ${providerProfile.address_zip}`
          : null,
        date: new Date(orderLine.orders.created_at).toLocaleDateString('en-US'),
        notes: '',
        quantity: orderLine.quantity || 1,
        signature: '',
        dispensing_option: 'dispense_as_written',
        refills_allowed: orderLine.refills_allowed ?? false,
        refills_total: orderLine.refills_total ?? 0,
        is_office_dispensing: orderLine.orders.ship_to === 'practice'
      };

      console.log('Built prescription data:', JSON.stringify(prescriptionData, null, 2));
    } else {
      // Use provided data (existing mode)
      prescriptionData = requestData;
    }

    const validation = validateGeneratePrescriptionRequest(prescriptionData);
    if (!validation.valid) {
      console.error('Prescription validation failed:', validation.errors);
      return createErrorResponse(
        'Invalid prescription data',
        400,
        null,
        validation.errors,
        corsHeaders
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
      patient_address_street,
      patient_address_city,
      patient_address_state,
      patient_address_zip,
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
    } = prescriptionData;


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
      .select('npi, dea, license_number, full_name, address_street, address_city, address_state, address_zip')
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

    // Use provider credentials directly
    const provider_npi = profileData.npi || '';
    const provider_dea = profileData.dea || '';
    const provider_license = profileData.license_number || '';

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

    // Compute prescriber display name
    const prescriberDisplayName = profileData.full_name || 
                                  provider_name || 
                                  'Provider';

    // Fetch and decrypt patient allergies if patient_id is provided
    let patient_allergies = 'NKDA';
    if (patient_id && !is_office_dispensing) {
      const { data: patientData, error: patientError } = await supabase
        .rpc('get_decrypted_patient_phi', { p_patient_id: patient_id });
      
      if (!patientError && patientData && patientData.length > 0) {
        patient_allergies = patientData[0].allergies || 'NKDA';
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

    // Top section: Prescriber name and credentials (two-line compact layout)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    
    // Line 1: Prescriber Name (left) + NPI (right)
    doc.text(prescriberDisplayName, 0.75, 0.75);
    const npiText = provider_npi ? `NPI: ${provider_npi}` : '';
    const npiWidth = doc.getTextWidth(npiText);
    doc.text(npiText, 7.75 - npiWidth, 0.75);
    
    // Line 2: DEA (left) + License (right)
    doc.setFontSize(10);
    const deaText = provider_dea ? `DEA: ${provider_dea}` : '';
    const licenseText = provider_license ? `License: ${provider_license}` : '';
    doc.text(deaText, 0.75, 0.95);
    const licenseWidth = doc.getTextWidth(licenseText);
    doc.text(licenseText, 7.75 - licenseWidth, 0.95);
    
    // Line below credentials
    doc.line(0.5, 1.1, 8, 1.1);

    // Helper to check if string is an email
    const isEmail = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str || '');
    
    // Helper to format address from components
    const formatAddress = (street: string | null, city: string | null, state: string | null, zip: string | null) => {
      const parts = [street, city, state, zip].filter(p => p && p.trim());
      return parts.length > 0 ? parts.join(', ') : null;
    };

    // Determine display values - never show email addresses
    const validPracticeName = practice_name && !isEmail(practice_name) ? practice_name : null;
    const validPracticeAddress = practice_address && practice_address !== 'N/A' && practice_address.trim() ? practice_address : null;

    // Fallback to provider data if practice data is invalid
    const displayName = validPracticeName || profileData.full_name || provider_name;
    const displayAddress = validPracticeAddress || 
                          formatAddress(profileData.address_street, profileData.address_city, 
                                       profileData.address_state, profileData.address_zip) ||
                          'Address on file';

    // Provider/Practice info (centered) - moved down after header credentials
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(displayName, 4.25, 1.45, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(displayAddress, 4.25, 1.75, { align: 'center' });

    // Patient information section
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT INFORMATION:', 0.75, 2.15);
    
    doc.setFontSize(9);
    const startY = 2.4;
    const rowHeight = 0.25; // Compact spacing for professional appearance

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
      // Improved patient info grid layout with structured address
      // Row 1: Name and DOB
      doc.setFont('helvetica', 'bold');
      doc.text('Name:', 0.75, startY);
      doc.setFont('helvetica', 'normal');
      doc.text(patient_name, 1.5, startY, { maxWidth: 2.8 });
      
      doc.setFont('helvetica', 'bold');
      doc.text('DOB:', 4.5, startY);
      doc.setFont('helvetica', 'normal');
      doc.text(patient_dob || 'N/A', 5.2, startY);

      // Row 2: Address Line 1 (Street) and Age
      doc.setFont('helvetica', 'bold');
      doc.text('Address:', 0.75, startY + rowHeight);
      doc.setFont('helvetica', 'normal');
      
      // Use structured address if available, otherwise fallback to formatted
      if (patient_address_street) {
        doc.text(patient_address_street, 1.5, startY + rowHeight, { maxWidth: 2.8 });
      } else if (patient_address) {
        // Fallback: use formatted address but remove USA suffix and show first line only
        const cleanAddr = (patient_address).replace(/, USA$/i, '');
        const firstLine = cleanAddr.split(',')[0];
        doc.text(firstLine, 1.5, startY + rowHeight, { maxWidth: 2.8 });
      } else {
        doc.text('N/A', 1.5, startY + rowHeight);
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text('Age:', 4.5, startY + rowHeight);
      doc.setFont('helvetica', 'normal');
      doc.text(patient_age?.toString() || 'N/A', 5.2, startY + rowHeight);

      // Row 3: Address Line 2 (City, State ZIP) and Sex
      doc.setFont('helvetica', 'normal');
      if (patient_address_city && patient_address_state && patient_address_zip) {
        const cityStateZip = `${patient_address_city}, ${patient_address_state} ${patient_address_zip}`;
        doc.text(cityStateZip, 1.5, startY + (rowHeight * 2), { maxWidth: 2.8 });
      } else if (patient_address) {
        // Fallback: show remaining parts of formatted address
        const cleanAddr = (patient_address).replace(/, USA$/i, '');
        const parts = cleanAddr.split(',');
        if (parts.length > 1) {
          const secondLine = parts.slice(1).join(',').trim();
          doc.text(secondLine, 1.5, startY + (rowHeight * 2), { maxWidth: 2.8 });
        }
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text('Sex:', 4.5, startY + (rowHeight * 2));
      doc.setFont('helvetica', 'normal');
      doc.text(patient_sex || 'N/A', 5.2, startY + (rowHeight * 2));

      // Row 4: Allergies and Date
      doc.setFont('helvetica', 'bold');
      doc.text('Allergies:', 0.75, startY + (rowHeight * 3));
      doc.setFont('helvetica', 'normal');
      doc.text(patient_allergies || 'NKDA', 1.5, startY + (rowHeight * 3), { maxWidth: 2.8 });
      
      doc.setFont('helvetica', 'bold');
      doc.text('Date:', 4.5, startY + (rowHeight * 3));
      doc.setFont('helvetica', 'normal');
      doc.text(date, 5.2, startY + (rowHeight * 3));
    }

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Large Rx symbol (moved down to avoid overlap)
    const rxY = 4.8;
    doc.setFontSize(60);
    doc.setFont('times', 'bold');
    doc.setTextColor(139, 69, 19); // Brown color
    doc.text('Rx', 0.8, rxY);

    // Medication information (in bordered box with enhanced visibility)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    const medBoxY = rxY - 0.3;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.03);
    doc.rect(3, medBoxY, 4.5, 0.6, 'S'); // Medication box with more height
    // Extract medication name without base dosage to avoid duplication
    const baseName = product_name.replace(/\s+\d+(\.\d+)?(mg|ml|g|mcg).*$/i, '').trim();
    doc.text(`${baseName} ${dosage || ''}`, 5.25, medBoxY + 0.42, { align: 'center' });

    // Medication details with improved readability
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const detailsY = medBoxY + 0.95;
    doc.setFont('helvetica', 'bold');
    doc.text('Sig:', 3, detailsY);
    doc.setFont('helvetica', 'normal');
    doc.text(sig || 'As directed by prescriber', 3.6, detailsY, { maxWidth: 4.2 });

    doc.setFont('helvetica', 'bold');
    doc.text('Quantity:', 3, detailsY + 0.35);
    doc.setFont('helvetica', 'normal');
    doc.text(quantity?.toString() || '1', 3.9, detailsY + 0.35);

    if (notes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', 3, detailsY + 0.7);
      doc.setFont('helvetica', 'normal');
      doc.text(notes, 3.6, detailsY + 0.7, { maxWidth: 4.2 });
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
    doc.text(`Prescriber: ${prescriberDisplayName}`, 4, sigY + 0.45, { align: 'center' });

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

    // Footer note with enhanced visibility
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.line(0.5, bottomY + 0.95, 8, bottomY + 0.95);
    doc.text('This prescription was generated electronically on ' + date + '.', 4.25, bottomY + 1.15, { align: 'center' });
    
    // Compliance statement (multi-line for readability)
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Generated via VitaLuxe Services, a HIPAA-compliant prescription management system.', 4.25, bottomY + 1.35, { align: 'center' });
    doc.text('Confidential Health Information — Disclosure or use without authorization is prohibited under HIPAA.', 4.25, bottomY + 1.50, { align: 'center' });
    doc.text('This document is not a DEA-certified e-prescription.', 4.25, bottomY + 1.65, { align: 'center' });
    doc.text('Prescription Order — To Be Verified by Pharmacy. Verify prescriber credentials before dispensing.', 4.25, bottomY + 1.80, { align: 'center' });
    
    // Digital signature seal
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'italic');
    const timestamp = new Date().toISOString();
    const documentId = `${Date.now()}-${provider_id.substring(0, 8)}`;
    doc.text(`Digitally verified by ${prescriberDisplayName} on ${date}. Document ID: ${documentId}`, 4.25, bottomY + 2.00, { align: 'center' });

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

      // Try uploading to S3 first, fallback to Supabase Storage
      let prescriptionUrl = '';
      let uploadMethod = 'supabase';

      try {
        const { data: s3Data, error: s3Error } = await supabase.functions.invoke('upload-to-s3', {
          body: {
            fileBuffer: Array.from(prescriptionData),
            fileName,
            contentType: 'application/pdf',
            metadata: {
              document_type: 'prescription',
              phi: 'true',
              patient_name,
              provider_id,
              is_office_dispensing: is_office_dispensing.toString()
            }
          }
        });

        if (!s3Error && s3Data?.success && s3Data.s3_key) {
          // Get signed URL from S3
          const { data: urlData } = await supabase.functions.invoke('get-s3-signed-url', {
            body: {
              s3_key: s3Data.s3_key,
              expires_in: 31536000 // 1 year
            }
          });

          if (urlData?.signed_url) {
            prescriptionUrl = urlData.signed_url;
            uploadMethod = 's3';
            console.log('Prescription uploaded to S3:', s3Data.s3_key);
          }
        }
      } catch (s3Error) {
        console.warn('S3 upload failed, falling back to Supabase Storage:', s3Error);
      }

      // Fallback to Supabase Storage if S3 upload failed
      if (!prescriptionUrl) {
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

        prescriptionUrl = signedUrlData?.signedUrl || uploadData.path;
        console.log('Prescription uploaded to Supabase Storage:', fileName);
      }

      console.log(`Prescription generated successfully via ${uploadMethod}:`, fileName);

      return new Response(
        JSON.stringify({
          success: true,
          prescription_url: prescriptionUrl,
          file_name: fileName,
          upload_method: uploadMethod
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
    console.error('Prescription PDF generation error:', error);
    return handleError(
      supabase,
      error,
      'generate-prescription-pdf',
      'internal',
      corsHeaders,
      { provider_id: requestData?.provider_id, product_name: requestData?.product_name }
    );
  }
});