import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
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

    const { terms_id, signature_name, target_user_id } = await req.json();

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

      // Additional check: only allow the specific authorized admin
      const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (userData?.user?.email !== 'admin@vitaluxeservice.com') {
        throw new Error('Unauthorized: You are not authorized to perform impersonation');
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

    // Add title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(terms.title, 0.5, 0.75);

    // Add content (parse markdown to plain text for PDF)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    const content = terms.content
      .replace(/^#+ /gm, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1'); // Remove italics

    const lines = doc.splitTextToSize(content, 7.5);
    let yPos = 1.25;
    const pageHeight = 10.5;
    
    lines.forEach((line: string) => {
      if (yPos > pageHeight - 2) {
        doc.addPage();
        yPos = 0.75;
      }
      doc.text(line, 0.5, yPos);
      yPos += 0.2;
    });

    // Add signature section on new page
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ACCEPTANCE AND SIGNATURE', 0.5, 1);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('I acknowledge that I have read and understood the above terms and conditions.', 0.5, 1.5);
    doc.text('I agree to be bound by these terms.', 0.5, 1.75);

    // Signature line
    doc.setLineWidth(0.01);
    doc.line(0.5, 2.75, 4, 2.75);
    doc.setFontSize(10);
    doc.text('Signature', 0.5, 3);
    
    // Add typed signature
    doc.setFontSize(16);
    doc.setFont('courier', 'italic');
    doc.text(signature_name, 0.5, 2.65);

    // Date line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.line(5, 2.75, 7.5, 2.75);
    doc.setFontSize(10);
    doc.text('Date', 5, 3);
    doc.text(new Date().toLocaleDateString(), 5, 2.65);

    // Add footer info
    doc.setFontSize(8);
    doc.text(`Signed by: ${profile?.name || profile?.email}`, 0.5, 3.5);
    doc.text(`Email: ${profile?.email}`, 0.5, 3.7);
    doc.text(`Date/Time: ${new Date().toISOString()}`, 0.5, 3.9);
    doc.text(`IP Address: ${ipAddress}`, 0.5, 4.1);
    doc.text(`Terms Version: ${terms.version}`, 0.5, 4.3);
    if (target_user_id && target_user_id !== actingUser.id) {
      doc.text(`Accepted by Admin: ${actingUser.email}`, 0.5, 4.5);
    }

    // Generate PDF as base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

    // Upload to storage (use target user's folder)
    const fileName = `${targetUserId}/terms_${Date.now()}.pdf`;
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

    // Record acceptance in database (for target user)
    const { data: acceptance, error: acceptanceError } = await supabase
      .from('user_terms_acceptances')
      .insert({
        user_id: targetUserId,
        terms_id: terms.id,
        role: terms.role,
        terms_version: terms.version,
        signature_name,
        signed_pdf_url: fileName,
        ip_address: ipAddress,
        user_agent: userAgent
      })
      .select()
      .single();

    if (acceptanceError) {
      console.error('Acceptance error:', acceptanceError);
      throw new Error('Failed to record acceptance');
    }

    // Update user_password_status (for target user)
    await supabase
      .from('user_password_status')
      .update({ terms_accepted: true })
      .eq('user_id', targetUserId);

    // Get signed URL for download
    const { data: signedUrl } = await supabase.storage
      .from('terms-signed')
      .createSignedUrl(fileName, 3600);

    return new Response(
      JSON.stringify({
        success: true,
        acceptance_id: acceptance.id,
        signed_pdf_url: signedUrl?.signedUrl,
        accepted_at: acceptance.accepted_at
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});