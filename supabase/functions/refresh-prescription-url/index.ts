import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, createAuthClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // PHASE 3 SECURITY: Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createAuthClient(authHeader);
    const adminClient = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      edgeLogger.error('[refresh-prescription-url] Auth failed', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 3 SECURITY: Rate limiting
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      adminClient,
      getClientIP(req),
      'refresh-prescription-url',
      { maxRequests: 50, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('[refresh-prescription-url] Rate limit exceeded', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prescriptionPath } = await req.json();

    if (!prescriptionPath) {
      return new Response(
        JSON.stringify({ error: 'prescriptionPath is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 3 SECURITY: Extract prescription ID from path and validate ownership
    // Expected path format: userId/prescriptionId/filename.pdf
    const pathParts = prescriptionPath.split('/');
    if (pathParts.length < 2) {
      edgeLogger.error('[refresh-prescription-url] Invalid path format', { prescriptionPath });
      return new Response(
        JSON.stringify({ error: 'Invalid prescription path format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prescriptionId = pathParts[1];

    // Validate user owns this prescription
    const { valid, error: idError } = await validateUserOwnsResource(
      adminClient,
      user.id,
      'prescription',
      prescriptionId
    );

    if (!valid) {
      edgeLogger.error('[refresh-prescription-url] ID validation failed', undefined, { 
        error: idError, 
        userId: user.id, 
        prescriptionId 
      });
      return new Response(
        JSON.stringify({ error: idError || 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('[refresh-prescription-url] Refreshing URL for path', { prescriptionPath });

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
