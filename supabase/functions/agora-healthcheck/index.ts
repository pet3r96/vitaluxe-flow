import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[agora-healthcheck] Running health check');

    // Validate environment variables
    const rawAppId = Deno.env.get('AGORA_APP_ID');
    const rawAppCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

    const appId = rawAppId?.trim();
    const appCertificate = rawAppCertificate?.trim();

    if (!appId || !appCertificate) {
      console.error('[agora-healthcheck] ❌ Missing Agora credentials');
      return new Response(JSON.stringify({ 
        healthy: false,
        error: 'Missing Agora credentials',
        details: {
          rawAppIdPresent: rawAppId !== undefined && rawAppId !== null,
          rawCertificatePresent: rawAppCertificate !== undefined && rawAppCertificate !== null,
          hasAppId: !!appId,
          hasCertificate: !!appCertificate
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate credential formats
    const appIdValid = appId.length === 32 && /^[a-f0-9]+$/i.test(appId);
    const certValid = appCertificate.length === 32 && /^[a-f0-9]+$/i.test(appCertificate);

    if (!appIdValid || !certValid) {
      console.error('[agora-healthcheck] ❌ Invalid credential format');
      return new Response(JSON.stringify({
        healthy: false,
        error: 'Invalid credential format',
        details: {
          appIdValid,
          certValid
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[agora-healthcheck] ✅ Health check passed');

    return new Response(JSON.stringify({
      healthy: true,
      appId,
      validation: {
        appIdLength: appId.length,
        certificateLength: appCertificate.length,
        formatsValid: true,
        trimmed: {
          appIdTrimmed: rawAppId !== appId,
          certificateTrimmed: rawAppCertificate !== appCertificate
        }
      },
      samples: {
        appIdSample: appId.substring(0, 6) + '...',
        certificateSample: appCertificate.substring(0, 6) + '...'
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[agora-healthcheck] Error:', error);
    return new Response(JSON.stringify({ 
      healthy: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
