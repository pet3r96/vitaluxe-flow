import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prescriptionPath } = await req.json();

    if (!prescriptionPath) {
      return new Response(
        JSON.stringify({ error: 'prescriptionPath is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('[refresh-prescription-url] Refreshing URL for path', { prescriptionPath });

    const adminClient = createAdminClient();

    // Generate new signed URL (valid for 1 year)
    const { data: signedUrlData, error: urlError } = await adminClient.storage
      .from('prescriptions')
      .createSignedUrl(prescriptionPath, 31536000); // 1 year in seconds

    if (urlError || !signedUrlData) {
      edgeLogger.error('[refresh-prescription-url] Failed to generate signed URL', urlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate signed URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('[refresh-prescription-url] Success - new URL generated');

    return new Response(
      JSON.stringify({ 
        success: true,
        signedUrl: signedUrlData.signedUrl 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    edgeLogger.error('[refresh-prescription-url] Unexpected error', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
