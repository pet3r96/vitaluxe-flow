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
      patient_address,
      provider_name,
      provider_npi,
      provider_dea,
      practice_name,
      practice_address,
      date,
      notes,
      quantity
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
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
          }
          .header {
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .practice-info {
            text-align: right;
            color: #64748b;
            font-size: 14px;
          }
          .rx-symbol {
            font-size: 48px;
            font-weight: bold;
            color: #2563eb;
            margin: 20px 0;
          }
          .section {
            margin: 20px 0;
            padding: 15px;
            background: #f8fafc;
            border-left: 4px solid #2563eb;
          }
          .section-title {
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 10px;
            text-transform: uppercase;
            font-size: 12px;
          }
          .content {
            color: #334155;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            color: #64748b;
            font-size: 12px;
          }
          .signature-line {
            margin-top: 40px;
            border-top: 1px solid #000;
            width: 300px;
          }
          .provider-info {
            margin-top: 10px;
            font-size: 12px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; color: #1e293b;">${practice_name}</h1>
          <div class="practice-info">
            ${practice_address}<br>
            Provider: ${provider_name}<br>
            NPI: ${provider_npi}${provider_dea ? ` | DEA: ${provider_dea}` : ''}
          </div>
        </div>

        <div class="rx-symbol">℞</div>
        
        <div style="margin: 20px 0;">
          <strong>Date:</strong> ${date}
        </div>

        <div class="section">
          <div class="section-title">Patient Information</div>
          <div class="content">
            <strong>Name:</strong> ${patient_name}<br>
            ${patient_dob ? `<strong>Date of Birth:</strong> ${patient_dob}<br>` : ''}
            ${patient_address ? `<strong>Address:</strong> ${patient_address}` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Prescription</div>
          <div class="content">
            <strong>${product_name}</strong><br>
            ${dosage ? `<strong>Dosage:</strong> ${dosage}<br>` : ''}
            ${quantity ? `<strong>Quantity:</strong> ${quantity}<br>` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Sig (Directions for Use)</div>
          <div class="content">
            ${sig || 'As directed by prescriber'}
          </div>
        </div>

        ${notes ? `
        <div class="section">
          <div class="section-title">Additional Notes</div>
          <div class="content">
            ${notes}
          </div>
        </div>
        ` : ''}

        <div style="margin-top: 60px;">
          <div class="signature-line"></div>
          <div class="provider-info">
            ${provider_name}<br>
            NPI: ${provider_npi}${provider_dea ? ` | DEA: ${provider_dea}` : ''}
          </div>
        </div>

        <div class="footer">
          This prescription was generated electronically on ${date}. 
          For pharmacy use only. Verify prescriber credentials before dispensing.
        </div>
      </body>
      </html>
    `;

    // Convert HTML to text-based prescription (simplified approach)
    // In production, you would use a proper HTML-to-PDF library
    const prescriptionText = `
PRESCRIPTION
============

Practice: ${practice_name}
${practice_address}
Provider: ${provider_name}
NPI: ${provider_npi}${provider_dea ? ` | DEA: ${provider_dea}` : ''}

Date: ${date}

PATIENT INFORMATION
-------------------
Name: ${patient_name}
${patient_dob ? `Date of Birth: ${patient_dob}` : ''}
${patient_address ? `Address: ${patient_address}` : ''}

PRESCRIPTION
------------
${product_name}
${dosage ? `Dosage: ${dosage}` : ''}
${quantity ? `Quantity: ${quantity}` : ''}

SIG (Directions for Use)
-------------------------
${sig || 'As directed by prescriber'}

${notes ? `ADDITIONAL NOTES\n----------------\n${notes}\n` : ''}

___________________________________
${provider_name}
NPI: ${provider_npi}${provider_dea ? ` | DEA: ${provider_dea}` : ''}

This prescription was generated electronically on ${date}.
For pharmacy use only. Verify prescriber credentials before dispensing.
    `.trim();

    // Create a Blob from the text content
    const fileName = `prescription_${patient_name.replace(/\s+/g, '_')}_${Date.now()}.txt`;
    const textEncoder = new TextEncoder();
    const prescriptionData = textEncoder.encode(prescriptionText);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('prescriptions')
      .upload(fileName, prescriptionData, {
        contentType: 'text/plain',
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