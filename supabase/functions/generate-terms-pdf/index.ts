import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import jsPDF from "https://esm.sh/jspdf@2.5.1";
import { validateGenerateTermsRequest } from '../_shared/requestValidators.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOGO_URL = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/practice-documents/logo.png`;

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

    const validation = validateGenerateTermsRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { terms_id, signature_name, target_user_id } = requestData;

    if (!terms_id || !signature_name) {
      throw new Error('Missing required fields');
    }

    // Determine the target user (for impersonation support)
    const actingUser = user;
    const targetUserId = target_user_id || user.id;

    // If impersonating (target_user_id provided and different from acting user)
    if (target_user_id && target_user_id !== user.id) {
      // Verify the acting user is an admin
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError || !roleData) {
        throw new Error('Unauthorized: Only admins can accept terms on behalf of other users');
      }
    }

    // Fetch terms content
    const { data: terms, error: termsError } = await supabase
      .from('terms_and_conditions')
      .select('*')
      .eq('id', terms_id)
      .single();

    if (termsError || !terms) {
      throw new Error('Terms not found');
    }

    // Fetch user profile for the target user
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', targetUserId)
      .single();

    // Get client info
    const ipAddress = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Generate PDF using jsPDF
    const doc = new jsPDF({
      unit: 'in',
      format: 'letter'
    });

    // Helper function to add footer to each page
    const addPageFooter = (pageNum: number, totalPages: number) => {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${pageNum} of ${totalPages}`, 4.25, 10.5, null, { align: 'center' });
      doc.text('VitaLuxe - Confidential Agreement', 0.5, 10.5);
      doc.setFontSize(7);
      doc.text(`Document Version ${terms.version}`, 7.95, 10.5, { align: 'right' });
    };

    // Professional Header with Logo
    const logoBase64 = await fetchLogoAsBase64(LOGO_URL);
    
    doc.setFillColor(200, 166, 75); // Gold color
    doc.rect(0, 0, 8.5, 1, 'F');
    
    if (logoBase64) {
      try {
        // Add logo on left side of header
        doc.addImage(logoBase64, 'PNG', 0.5, 0.25, 0.5, 0.5);
      } catch (e) {
        console.warn('Failed to add logo to PDF:', e);
      }
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('VITALUXE SERVICES LLC', 4.25, 0.65, { align: 'center' });

    // Document Title with Border
    doc.setDrawColor(200, 166, 75);
    doc.setLineWidth(0.03);
    doc.rect(0.5, 1.25, 7.5, 1.0);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    
    // Allow title to wrap if needed
    const wrappedTitle = doc.splitTextToSize(terms.title.toUpperCase(), 7.0);
    const titleY = 1.25 + 0.5;
    doc.text(wrappedTitle, 4.25, titleY, { align: 'center' });

    // Parse markdown content with enhanced formatting for BAA and sub-bullets
    const contentLines: string[] = [];
    const allSections = terms.content.split(/(?=^#+ )/gm);
    
    allSections.forEach((section: string, sectionIndex: number) => {
      if (section.trim()) {
        // Check for major section header (single #) - like BAA
        const majorHeaderMatch = section.match(/^# (.+)/);
        if (majorHeaderMatch) {
          // Add extra spacing before major sections (except first section)
          if (sectionIndex > 0) {
            contentLines.push('MAJOR_SPACING');
          }
          contentLines.push(`MAJOR_HEADER:${majorHeaderMatch[1]}`);
          const body = section.replace(/^# .+\n/, '').trim();
          processBodyContent(body, contentLines);
          contentLines.push('SPACING');
          return;
        }
        
        // Check for regular section header (##)
        const headerMatch = section.match(/^## (.+)/);
        if (headerMatch) {
          contentLines.push(`SECTION_HEADER:${headerMatch[1]}`);
          const body = section.replace(/^## .+\n/, '').trim();
          processBodyContent(body, contentLines);
          contentLines.push('SPACING');
        }
      }
    });
    
    // Helper function to process body content with sub-bullet detection
    function processBodyContent(body: string, lines: string[]) {
      const bodyLines = body.split('\n');
      let inSubBulletContext = false;
      
      bodyLines.forEach((line: string) => {
        const trimmedLine = line.trim();
        
        if (!trimmedLine) {
          return;
        }
        
        // Detect sub-bullets: lines starting with lowercase letter + period
        // Also handle patterns like "(a.", "(b.", etc.
        const subBulletMatch = trimmedLine.match(/^(\()?([a-z])\.\s*(.+)/);
        
        if (trimmedLine.startsWith('- ')) {
          // Regular bullet point
          const bulletContent = trimmedLine.substring(2).trim();
          
          // Check if this bullet contains sub-items inline (e.g., "text. a. more text")
          const inlineSplit = bulletContent.split(/\s+([a-z])\.\s+/);
          if (inlineSplit.length > 1) {
            // Split inline sub-bullets into separate lines
            lines.push(`BULLET:${inlineSplit[0].trim()}`);
            for (let i = 1; i < inlineSplit.length; i += 2) {
              if (inlineSplit[i] && inlineSplit[i + 1]) {
                lines.push(`SUB_BULLET:(${inlineSplit[i]}.) ${inlineSplit[i + 1].trim()}`);
              }
            }
          } else {
            lines.push(`BULLET:${bulletContent}`);
          }
          inSubBulletContext = true;
        } else if (subBulletMatch) {
          // Explicit sub-bullet (a., b., c., etc.)
          const letter = subBulletMatch[2];
          const content = subBulletMatch[3].trim();
          lines.push(`SUB_BULLET:(${letter}.) ${content}`);
          inSubBulletContext = true;
        } else {
          // Regular text
          lines.push(`TEXT:${trimmedLine}`);
          inSubBulletContext = false;
        }
      });
    }

    let yPos = 2.75;
    const pageHeight = 10.5;
    const leftMargin = 0.5;
    const rightMargin = 8.0;
    const contentWidth = 7.5;
    let pageNum = 1;

    contentLines.forEach((line) => {
      // Check if we need a new page
      if (yPos > pageHeight - 1) {
        // Don't add footer yet - wait until we know total pages
        doc.addPage();
        pageNum++;
        yPos = 0.75;
      }

      if (line.startsWith('MAJOR_HEADER:')) {
        // Major section header (like BAA) - larger, more prominent
        const headerText = line.replace('MAJOR_HEADER:', '');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(headerText, leftMargin, yPos);
        
        // Thicker underline with gold color
        doc.setDrawColor(200, 166, 75);
        doc.setLineWidth(0.025);
        doc.line(leftMargin, yPos + 0.1, rightMargin, yPos + 0.1);
        yPos += 0.45;
        
      } else if (line.startsWith('SECTION_HEADER:')) {
        const headerText = line.replace('SECTION_HEADER:', '');
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(headerText, leftMargin, yPos);
        
        // Underline with gold color
        doc.setDrawColor(200, 166, 75);
        doc.setLineWidth(0.015);
        doc.line(leftMargin, yPos + 0.08, rightMargin, yPos + 0.08);
        yPos += 0.35;
        
      } else if (line.startsWith('BULLET:')) {
        const bulletText = line.replace('BULLET:', '');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 51, 51);
        
        const wrappedLines = doc.splitTextToSize(bulletText, 6.8);
        doc.text('•', leftMargin + 0.1, yPos);
        doc.text(wrappedLines, leftMargin + 0.3, yPos);
        yPos += wrappedLines.length * 0.18;
        
      } else if (line.startsWith('SUB_BULLET:')) {
        // Sub-bullet (a., b., c., d.) - indented further
        const subBulletText = line.replace('SUB_BULLET:', '');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 51, 51);
        
        const wrappedLines = doc.splitTextToSize(subBulletText, 6.4);
        doc.text(wrappedLines, leftMargin + 0.5, yPos);
        yPos += wrappedLines.length * 0.18;
        
      } else if (line.startsWith('TEXT:')) {
        const text = line.replace('TEXT:', '');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 51, 51);
        
        const wrappedLines = doc.splitTextToSize(text, 7.4);
        doc.text(wrappedLines, leftMargin, yPos);
        yPos += wrappedLines.length * 0.18;
        
      } else if (line === 'SPACING') {
        yPos += 0.25;
      } else if (line === 'MAJOR_SPACING') {
        // Extra spacing before major sections (like BAA)
        yPos += 0.5;
      }
    });

    // Don't add footer yet - will be added in second pass with correct total

    // SIGNATURE PAGE - Always on new page
    doc.addPage();
    pageNum++;

    // Decorative background
    doc.setFillColor(250, 250, 250);
    doc.rect(0.5, 1.5, 7.5, 7.5, 'F');
    
    // Border
    doc.setDrawColor(200, 166, 75);
    doc.setLineWidth(0.04);
    doc.rect(0.5, 1.5, 7.5, 7.5);

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('AGREEMENT ACCEPTANCE', 4.25, 2, { align: 'center' });

    // Decorative line
    doc.setDrawColor(200, 166, 75);
    doc.setLineWidth(0.02);
    doc.line(2.0, 2.2, 6.5, 2.2);

    // Acceptance text
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 51, 51);
    const acceptanceText = `I, ${signature_name}, hereby acknowledge that I have read, understood, and agree to be bound by the terms and conditions set forth in this agreement.`;
    const wrappedAcceptance = doc.splitTextToSize(acceptanceText, 6);
    doc.text(wrappedAcceptance, 1.25, 2.7);

    // Signature boxes
    const sigBoxY = 4.2;
    
    // Signature box - repositioned and widened
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.02);
    doc.rect(0.75, sigBoxY, 4.0, 1.2);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Electronic Signature', 0.85, sigBoxY - 0.1);
    
    // Add signature - centered in new box
    doc.setFontSize(18);
    doc.setFont('courier', 'italic');
    doc.setTextColor(0, 0, 139);
    doc.text(signature_name, 2.75, sigBoxY + 0.7, { align: 'center' });

    // Date box - repositioned
    doc.setDrawColor(100, 100, 100);
    doc.rect(5.0, sigBoxY, 2.75, 1.2);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Date', 5.1, sigBoxY - 0.1);
    
    // Date text - centered in new box
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const dateString = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    doc.text(dateString, 6.375, sigBoxY + 0.7, { align: 'center' });

    // Signatory information section
    const infoY = 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('SIGNATORY INFORMATION', 1.25, infoY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Name:`, 1.25, infoY + 0.3);
    doc.text(`${profile?.name || 'N/A'}`, 2.5, infoY + 0.3);
    
    doc.text(`Email:`, 1.25, infoY + 0.55);
    doc.text(`${profile?.email}`, 2.5, infoY + 0.55);
    
    doc.text(`Role:`, 1.25, infoY + 0.8);
    doc.text(`${terms.role.charAt(0).toUpperCase() + terms.role.slice(1)}`, 2.5, infoY + 0.8);

    // Acceptance metadata
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('ACCEPTANCE METADATA', 1.25, infoY + 1.3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Timestamp: ${new Date().toISOString()}`, 1.25, infoY + 1.55);
    doc.text(`IP Address: ${ipAddress}`, 1.25, infoY + 1.75);
    doc.text(`User Agent: ${userAgent.substring(0, 60)}`, 1.25, infoY + 1.95);
    if (target_user_id && target_user_id !== actingUser.id) {
      doc.text(`Accepted by Admin: ${actingUser.email}`, 1.25, infoY + 2.15);
    }

    // Legal disclaimer
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'italic');
    const disclaimer = 'This document constitutes a legally binding electronic agreement. By providing an electronic signature above, you acknowledge your consent to be bound by these terms.';
    const wrappedDisclaimer = doc.splitTextToSize(disclaimer, 6);
    doc.text(wrappedDisclaimer, 1.25, 8.5);

    // Update total page count on all pages
    const totalPages = pageNum;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      if (i < totalPages) {
        addPageFooter(i, totalPages);
      } else {
        // Footer for signature page
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${totalPages}`, 4.25, 10.5, null, { align: 'center' });
        doc.text('VitaLuxe - Confidential Agreement', 0.5, 10.5);
        doc.setFontSize(7);
        doc.text(`Document Version ${terms.version}`, 7.95, 10.5, { align: 'right' });
      }
    }

    // Generate PDF as base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

    // Upload to storage (use target user's folder)
    const fileName = `${targetUserId}/terms_${Date.now()}.pdf`;
    
    // Try uploading to S3 first, fallback to Supabase Storage
    let termsUrl = '';
    let uploadMethod = 'supabase';

    try {
      const { data: s3Data, error: s3Error } = await supabase.functions.invoke('upload-to-s3', {
        body: {
          fileBuffer: Array.from(pdfBytes),
          fileName,
          contentType: 'application/pdf',
          metadata: {
            document_type: 'terms',
            phi: 'false',
            user_id: targetUserId,
            terms_id,
            terms_version: terms.version
          }
        }
      });

      if (!s3Error && s3Data?.success && s3Data.s3_key) {
        uploadMethod = 's3';
        console.log('Terms PDF uploaded to S3:', s3Data.s3_key);
      }
    } catch (s3Error) {
      console.warn('S3 upload failed, falling back to Supabase Storage:', s3Error);
    }

    // Fallback to Supabase Storage if S3 upload failed
    if (uploadMethod !== 's3') {
      const { error: uploadError } = await supabase.storage
        .from('terms-signed')
        .upload(fileName, pdfBytes, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Failed to upload PDF');
      }
      console.log('Terms PDF uploaded to Supabase Storage:', fileName);
    }

    // Record acceptance in database (for target user)
    // Use upsert to handle cases where user re-accepts terms
    const { data: acceptance, error: acceptanceError } = await supabase
      .from('user_terms_acceptances')
      .upsert({
        user_id: targetUserId,
        terms_id: terms.id,
        role: terms.role,
        terms_version: terms.version,
        signature_name,
        signed_pdf_url: fileName,
        ip_address: ipAddress,
        user_agent: userAgent,
        accepted_at: new Date().toISOString() // Explicitly update timestamp
      }, {
        onConflict: 'user_id,terms_id', // Handle duplicate key constraint
        ignoreDuplicates: false // Update existing records
      })
      .select()
      .single();

    if (acceptanceError) {
      console.error('Acceptance error:', acceptanceError);
      throw new Error('Failed to record acceptance');
    }

    // Update user_password_status (for target user) - using UPSERT to handle missing rows
    const { error: statusError } = await supabase
      .from('user_password_status')
      .upsert({
        user_id: targetUserId,
        terms_accepted: true,
        must_change_password: false  // Default to false for new rows
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false  // Update if exists
      });

    if (statusError) {
      console.error('Error updating user_password_status:', statusError);
      // Don't throw - acceptance was recorded, this is just status sync
    }

    // Get signed URL for download
    if (uploadMethod === 's3') {
      const { data: urlData } = await supabase.functions.invoke('get-s3-signed-url', {
        body: {
          s3_key: fileName,
          expires_in: 3600
        }
      });
      termsUrl = urlData?.signed_url || '';
    } else {
      const { data: signedUrl } = await supabase.storage
        .from('terms-signed')
        .createSignedUrl(fileName, 3600);
      termsUrl = signedUrl?.signedUrl || '';
    }

    return new Response(
      JSON.stringify({
        success: true,
        acceptance_id: acceptance.id,
        signed_pdf_url: termsUrl,
        accepted_at: acceptance.accepted_at,
        upload_method: uploadMethod
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing the request' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});