import { RtcTokenBuilder, RtcRole, RtmTokenBuilder, RtmRole } from 'https://esm.sh/agora-token@2.0.3';
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
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

    if (!appId || !appCertificate) {
      console.error('[agora-healthcheck] ❌ Missing Agora credentials');
      return new Response(JSON.stringify({ 
        healthy: false,
        error: 'Missing Agora credentials',
        details: {
          hasAppId: !!appId,
          hasCertificate: !!appCertificate
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Test token generation
    const testChannel = 'healthcheck';
    const testUid = 0;
    const testAccount = 'healthcheck-user';
    const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    const startTime = Date.now();

    try {
      // Generate RTC token
      const rtcToken = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        testChannel,
        testUid,
        RtcRole.PUBLISHER,
        expirationTime,
        expirationTime
      );

      // Generate RTM token
      const rtmToken = RtmTokenBuilder.buildToken(
        appId,
        appCertificate,
        testAccount,
        RtmRole.Rtm_User,
        expirationTime
      );

      const duration = Date.now() - startTime;

      console.log('[agora-healthcheck] ✅ Health check passed', {
        duration_ms: duration,
        token_expiry: new Date(expirationTime * 1000).toISOString()
      });

      return new Response(JSON.stringify({
        healthy: true,
        appId,
        tokenGeneration: {
          success: true,
          duration_ms: duration,
          token_expiry: new Date(expirationTime * 1000).toISOString()
        },
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (tokenError) {
      console.error('[agora-healthcheck] ❌ Token generation failed:', tokenError);
      return new Response(JSON.stringify({
        healthy: false,
        error: 'Token generation failed',
        details: tokenError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
