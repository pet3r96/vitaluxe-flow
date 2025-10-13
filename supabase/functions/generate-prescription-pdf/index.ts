import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      signature
    } = await req.json();

    console.log('Generating prescription PDF for:', product_name);

    // Generate HTML prescription
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Times New Roman', Times, serif;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 0.5in;
            background: #f5f5dc;
            border: 2px solid #000;
          }
          
          .credentials-header {
            display: flex;
            justify-content: space-around;
            padding: 10px;
            border-bottom: 2px solid #000;
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 20px;
          }
          
          .practice-info {
            text-align: center;
            margin-bottom: 30px;
          }
          
          .practice-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .practice-address {
            font-size: 12px;
          }
          
          .patient-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 30px;
            font-size: 13px;
          }
          
          .patient-field {
            display: flex;
            gap: 10px;
          }
          
          .patient-field strong {
            min-width: 80px;
          }
          
          .rx-section {
            display: flex;
            align-items: flex-start;
            margin: 40px 0;
            min-height: 120px;
          }
          
          .rx-symbol {
            font-size: 120px;
            font-family: 'Times New Roman', serif;
            font-weight: bold;
            color: #8B4513;
            line-height: 1;
            margin-right: 30px;
            flex-shrink: 0;
          }
          
          .medication-info {
            flex-grow: 1;
            padding-top: 30px;
          }
          
          .medication-name {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 15px;
            border: 2px solid #000;
            padding: 10px;
            border-radius: 5px;
          }
          
          .medication-details {
            font-size: 14px;
            line-height: 1.8;
          }
          
          .signature-section {
            margin-top: 80px;
            margin-bottom: 30px;
          }
          
          .signature-text {
            font-family: 'Brush Script MT', cursive;
            font-size: 24px;
            margin-bottom: 5px;
            height: 30px;
          }
          
          .signature-line {
            border-top: 2px solid #000;
            width: 100%;
            margin-top: 10px;
            padding-top: 5px;
            text-align: center;
            font-size: 12px;
          }
          
          .bottom-section {
            display: flex;
            justify-content: space-between;
            border-top: 2px solid #000;
            padding-top: 15px;
            margin-top: 30px;
            font-size: 13px;
          }
          
          .refills-section,
          .dispense-section {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .checkbox {
            width: 15px;
            height: 15px;
            border: 2px solid #000;
            display: inline-block;
          }
          
          .footer-note {
            margin-top: 20px;
            font-size: 10px;
            color: #666;
            text-align: center;
            border-top: 1px solid #ccc;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="credentials-header">
          <div>DEA# ${provider_dea || 'N/A'}</div>
          <div>License# ${provider_license || 'N/A'}</div>
          <div>NPI# ${provider_npi}</div>
        </div>
        
        <div class="practice-info">
          <div class="practice-name">${provider_name}</div>
          <div class="practice-name">${practice_name}</div>
          <div class="practice-address">${practice_address}</div>
        </div>
        
        <div class="patient-section">
          <div class="patient-field">
            <strong>Name:</strong>
            <span>${patient_name}</span>
          </div>
          <div class="patient-field">
            <strong>DOB:</strong>
            <span>${patient_dob || 'N/A'}</span>
          </div>
          <div class="patient-field">
            <strong>Address:</strong>
            <span>${patient_address || 'N/A'}</span>
          </div>
          <div class="patient-field">
            <strong>Age:</strong>
            <span>${patient_age || 'N/A'}</span>
          </div>
          <div class="patient-field">
            <strong>Allergies:</strong>
            <span>${patient_allergies || 'NKDA'}</span>
          </div>
          <div class="patient-field">
            <strong>Sex:</strong>
            <span>${patient_sex || 'N/A'}</span>
          </div>
          <div class="patient-field">
            <strong>Weight:</strong>
            <span>_____ lbs</span>
          </div>
          <div class="patient-field">
            <strong>Date:</strong>
            <span>${date}</span>
          </div>
        </div>
        
        <div class="rx-section">
          <div class="rx-symbol">℞</div>
          <div class="medication-info">
            <div class="medication-name">${product_name} ${dosage || ''}</div>
            <div class="medication-details">
              <div><strong>Sig:</strong> ${sig || 'As directed by prescriber'}</div>
              <div><strong>Quantity:</strong> ${quantity || '1'}</div>
              ${notes ? `<div><strong>Notes:</strong> ${notes}</div>` : ''}
            </div>
          </div>
        </div>
        
        <div class="signature-section">
          <div class="signature-text">${signature || ''}</div>
          <div class="signature-line">
            Prescriber Signature
          </div>
        </div>
        
        <div class="bottom-section">
          <div class="refills-section">
            <strong>Refills:</strong>
            <span class="checkbox"></span>
            <span>_______</span>
          </div>
          <div class="dispense-section">
            <span class="checkbox"></span>
            <span>Dispense as Written</span>
            <span style="margin-left: 30px;" class="checkbox"></span>
            <span>May Substitute</span>
          </div>
        </div>
        
        <div class="footer-note">
          This prescription was generated electronically on ${date}.
          For pharmacy use only. Verify prescriber credentials before dispensing.
        </div>
      </body>
      </html>
    `;

    // Use the HTML prescription format
    const fileName = `prescription_${patient_name.replace(/\s+/g, '_')}_${Date.now()}.html`;
    const textEncoder = new TextEncoder();
    const prescriptionData = textEncoder.encode(html);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('prescriptions')
      .upload(fileName, prescriptionData, {
        contentType: 'text/html',
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