import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import jsPDF from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Fetch practice branding (logo URL and practice name)
 */
const getPracticeBranding = async (supabase: any, userId: string) => {
  // Fetch branding directly by practice_id = user.id
  const { data: branding } = await supabase
    .from('practice_branding')
    .select('logo_url, practice_name')
    .eq('practice_id', userId)
    .maybeSingle();

  // Fallback to profile name if branding name not set
  let practiceName = branding?.practice_name;
  if (!practiceName) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company, name')
      .eq('id', userId)
      .maybeSingle();
    
    practiceName = profile?.company || profile?.name || 'VITALUXE SERVICES LLC';
  }

  return {
    logoUrl: branding?.logo_url || null,
    practiceName,
  };
};

/**
 * Fetch logo image and convert to base64 with content type detection
 */
const fetchLogoAsBase64 = async (url: string): Promise<{ base64: string; format: string } | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const contentType = response.headers.get('content-type') || '';
    
    // Skip SVG as jsPDF doesn't support it natively
    if (contentType.includes('svg')) {
      console.log('SVG logos are not supported in PDF generation');
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    
    // Determine format for jsPDF
    const format = contentType.includes('png') ? 'PNG' : 'JPEG';
    
    return { base64, format };
  } catch (error) {
    console.error('Error fetching logo:', error);
    return null;
  }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for active impersonation
    let effectivePracticeId = user.id;

    const { data: impersonation } = await supabase
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .maybeSingle();

    if (impersonation?.impersonated_user_id) {
      effectivePracticeId = impersonation.impersonated_user_id;
      console.log(`Using impersonated practice: ${effectivePracticeId}`);
    }

    console.log(`Generating branding preview PDF for user: ${user.id}${effectivePracticeId !== user.id ? ` (impersonating: ${effectivePracticeId})` : ''}`);

    // Fetch practice branding
    const { logoUrl, practiceName } = await getPracticeBranding(supabase, effectivePracticeId);
    
    const displayName = practiceName || "VITALUXE SERVICES LLC";
    console.log(`Using practice name: ${displayName}, Logo URL: ${logoUrl}`);

    // Initialize PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPosition = 20;

    // Add branded header with golden background
    pdf.setFillColor(200, 166, 75); // #C8A64B
    pdf.rect(0, 0, pageWidth, 30, 'F');

    // Add logo if available
    if (logoUrl) {
      try {
        const logoData = await fetchLogoAsBase64(logoUrl);
        if (logoData) {
          pdf.addImage(logoData.base64, logoData.format, 15, 8, 15, 15);
          console.log('Logo added to PDF');
        }
      } catch (error) {
        console.error('Error adding logo to PDF:', error);
      }
    }

    // Add practice name
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    const nameX = logoUrl ? 35 : 15;
    pdf.text(displayName, nameX, 18);

    // No additional content - header-only preview

    // Generate PDF as base64
    const pdfBase64 = pdf.output('datauristring').split(',')[1];

    console.log('Branding preview PDF generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        pdfBase64,
        filename: 'Branding_Preview.pdf',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error generating branding preview PDF:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate preview PDF',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
