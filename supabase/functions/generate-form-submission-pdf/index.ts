import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import jsPDF from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get practice logo URL
async function getPracticeLogoUrl(supabase: any, userId: string): Promise<string | null> {
  try {
    // Get practice_id (user might be practice owner or provider)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!profile) return null;

    // Get practice branding
    const { data: branding } = await supabase
      .from('practice_branding')
      .select('logo_url')
      .eq('practice_id', profile.id)
      .maybeSingle();

    return branding?.logo_url || null;
  } catch (error) {
    console.warn('Failed to get practice logo:', error);
    return null;
  }
}

// Helper function to fetch logo as base64
async function fetchLogoAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return base64;
  } catch (error) {
    console.warn('Failed to fetch logo:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { submissionId } = await req.json();

    if (!submissionId) {
      throw new Error('submissionId is required');
    }

    // Get submission with form details and patient info
    const { data: submission, error: subError } = await supabase
      .from('patient_form_submissions')
      .select(`
        *,
        practice_forms(form_name, form_schema),
        patients(first_name, last_name),
        patient_accounts(full_name, email)
      `)
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      throw new Error('Submission not found');
    }

    // Generate PDF using jsPDF
    const doc = new jsPDF({
      unit: 'in',
      format: 'letter'
    });

    // Fetch logo dynamically from practice branding
    const logoUrl = await getPracticeLogoUrl(supabase, user.id);
    const logoBase64 = logoUrl ? await fetchLogoAsBase64(logoUrl) : null;

    // Professional Header with Logo
    doc.setFillColor(200, 166, 75); // Gold color
    doc.rect(0, 0, 8.5, 1, 'F');
    
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 0.5, 0.25, 0.5, 0.5);
      } catch (e) {
        console.warn('Failed to add logo to PDF:', e);
      }
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('VITALUXE SERVICES LLC', 4.25, 0.65, { align: 'center' });

    // Document Title
    doc.setDrawColor(200, 166, 75);
    doc.setLineWidth(0.03);
    doc.rect(0.5, 1.25, 7.5, 0.6);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('FORM SUBMISSION', 4.25, 1.65, { align: 'center' });

    // Form and Patient Information Section
    let yPos = 2.2;
    const leftMargin = 0.5;
    const contentWidth = 7.5;

    // Form Name
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(submission.practice_forms.form_name, leftMargin, yPos);
    yPos += 0.3;

    // Patient and Status Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 51, 51);
    
    const patientName = submission.patient_accounts?.full_name || 
                       `${submission.patients.first_name} ${submission.patients.last_name}`;
    doc.text(`Patient: ${patientName}`, leftMargin, yPos);
    yPos += 0.2;
    
    const completedDate = submission.completed_at 
      ? new Date(submission.completed_at).toLocaleDateString('en-US', { 
          year: 'numeric', month: 'long', day: 'numeric' 
        })
      : 'Not completed';
    doc.text(`Completed: ${completedDate}`, leftMargin, yPos);
    yPos += 0.2;
    
    doc.text(`Status: ${submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}`, leftMargin, yPos);
    yPos += 0.4;

    // Separator line
    doc.setDrawColor(200, 166, 75);
    doc.setLineWidth(0.02);
    doc.line(leftMargin, yPos, leftMargin + contentWidth, yPos);
    yPos += 0.4;

    // Form Responses Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Form Responses', leftMargin, yPos);
    yPos += 0.3;

    const formData = submission.form_data || {};
    
    if (Object.keys(formData).length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      for (const [key, value] of Object.entries(formData)) {
        // Check if we need a new page
        if (yPos > 9.5) {
          doc.addPage();
          yPos = 0.75;
        }

        // Question/Field label
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        const wrappedQuestion = doc.splitTextToSize(key, contentWidth - 0.5);
        doc.text(wrappedQuestion, leftMargin + 0.2, yPos);
        yPos += wrappedQuestion.length * 0.18;

        // Answer/Value
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const answerText = String(value);
        const wrappedAnswer = doc.splitTextToSize(answerText, contentWidth - 0.5);
        doc.text(wrappedAnswer, leftMargin + 0.2, yPos);
        yPos += wrappedAnswer.length * 0.18 + 0.25;
      }
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150, 150, 150);
      doc.text('No responses recorded', leftMargin + 0.2, yPos);
      yPos += 0.3;
    }

    // Signature Section (if available)
    if (submission.signature_data?.signature_image) {
      // Check if we need a new page for signature
      if (yPos > 8.5) {
        doc.addPage();
        yPos = 0.75;
      }

      yPos += 0.3;
      doc.setDrawColor(200, 166, 75);
      doc.setLineWidth(0.02);
      doc.line(leftMargin, yPos, leftMargin + contentWidth, yPos);
      yPos += 0.4;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Signature', leftMargin, yPos);
      yPos += 0.3;

      try {
        // Add signature image
        const signatureImg = submission.signature_data.signature_image;
        doc.addImage(signatureImg, 'PNG', leftMargin + 0.2, yPos, 2.5, 0.8);
        yPos += 1.0;
      } catch (e) {
        console.warn('Failed to add signature to PDF:', e);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 150, 150);
        doc.text('Signature image could not be loaded', leftMargin + 0.2, yPos);
        yPos += 0.3;
      }

      if (submission.signed_at) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        const signedDate = new Date(submission.signed_at).toLocaleString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric', 
          hour: '2-digit', minute: '2-digit'
        });
        doc.text(`Signed on: ${signedDate}`, leftMargin + 0.2, yPos);
      }
    }

    // Footer on every page
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${i} of ${totalPages}`, 4.25, 10.5, { align: 'center' });
      doc.text('VitaLuxe Form Submission', 0.5, 10.5);
      doc.setFontSize(7);
      const timestamp = new Date().toLocaleDateString();
      doc.text(`Generated ${timestamp}`, 7.95, 10.5, { align: 'right' });
    }

    // Generate PDF as base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

    // Upload to storage
    const fileName = `${user.id}/form_submissions/${submissionId}_${Date.now()}.pdf`;
    
    const { error: uploadError } = await supabase.storage
      .from('practice-documents')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload PDF');
    }

    console.log('Form submission PDF uploaded:', fileName);

    // Get signed URL for download
    const { data: signedUrl } = await supabase.storage
      .from('practice-documents')
      .createSignedUrl(fileName, 3600);

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl: signedUrl?.signedUrl || '',
        fileName: fileName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred processing the request' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
