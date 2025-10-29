import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// @ts-ignore: jsPDF types
import jsPDF from 'npm:jspdf@2.5.2';

/**
 * Fetch practice branding (logo URL and practice name)
 */
const getPracticeBranding = async (supabase: any, userId: string) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('practice_id')
    .eq('id', userId)
    .single();

  if (!profile?.practice_id) return { logoUrl: null, practiceName: null };

  const { data: branding } = await supabase
    .from('practice_branding')
    .select('logo_url, practice_name')
    .eq('practice_id', profile.practice_id)
    .single();

  return {
    logoUrl: branding?.logo_url || null,
    practiceName: branding?.practice_name || null,
  };
};

/**
 * Fetch logo image and convert to base64
 */
const fetchLogoAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return base64;
  } catch (error) {
    console.error('Error fetching logo:', error);
    return null;
  }
};

Deno.serve(async (req) => {
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

    console.log(`Generating branding preview PDF for user: ${user.id}`);

    // Fetch practice branding
    const { logoUrl, practiceName } = await getPracticeBranding(supabase, user.id);
    
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
        const logoBase64 = await fetchLogoAsBase64(logoUrl);
        if (logoBase64) {
          // Determine image format from URL
          const imageFormat = logoUrl.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
          pdf.addImage(logoBase64, imageFormat, 15, 8, 15, 15);
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

    // Reset text color for content
    pdf.setTextColor(0, 0, 0);
    yPosition = 45;

    // Add preview content
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Branding Preview', 15, yPosition);
    
    yPosition += 10;
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    
    const previewText = [
      'This is a preview of how your practice branding will appear on generated PDFs.',
      '',
      'Your logo and practice name will be displayed at the top of all documents,',
      'including patient forms, terms and conditions, and other official documents.',
      '',
      'If you are satisfied with how your branding looks, you can close this preview.',
      'If you would like to make adjustments, return to the branding settings and',
      'upload a different logo or update your practice name.',
    ];

    previewText.forEach((line) => {
      pdf.text(line, 15, yPosition);
      yPosition += 6;
    });

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
