import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createAgoraTokens } from "../_shared/agoraTokenService.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action = 'health', channel = 'test-channel', uid = 'test-user' } = await req.json().catch(() => ({}));
    
    const appId = Deno.env.get('AGORA_APP_ID') || '';
    const appCert = Deno.env.get('AGORA_APP_CERTIFICATE') || '';
    
    switch (action) {
      case 'echo': {
        // Echo back diagnostic information without sensitive data
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              echo: true,
              timestamp: new Date().toISOString(),
              appIdConfigured: !!appId,
              appCertConfigured: !!appCert,
              appIdLength: appId.length,
              appCertLength: appCert.length,
              appIdPrefix: appId.substring(0, 8) + '...',
              channel,
              uid
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'health': {
        // Health check - verify credentials are configured
        const healthy = !!appId && !!appCert && appId.length > 0 && appCert.length > 0;
        
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              status: healthy ? 'healthy' : 'unhealthy',
              timestamp: new Date().toISOString(),
              credentials: {
                appId: appId ? 'configured' : 'missing',
                appCertificate: appCert ? 'configured' : 'missing'
              }
            }
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: healthy ? 200 : 503
          }
        );
      }
      
      case 'config': {
        // Verify configuration without exposing secrets
        if (!appId || !appCert) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Agora credentials not configured',
              data: {
                appId: appId ? 'configured' : 'missing',
                appCertificate: appCert ? 'configured' : 'missing'
              }
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            }
          );
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              configured: true,
              appIdLength: appId.length,
              appCertLength: appCert.length,
              appIdFormat: /^[a-f0-9]{32}$/i.test(appId) ? 'valid' : 'invalid',
              timestamp: new Date().toISOString()
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'debug': {
        // Generate test tokens for debugging
        if (!appId || !appCert) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Agora credentials not configured'
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            }
          );
        }
        
        try {
          const tokens = await createAgoraTokens(channel, uid, 'publisher', 3600);
          
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                channel,
                uid,
                rtcTokenPrefix: tokens.rtcToken.substring(0, 20) + '...',
                rtmTokenPrefix: tokens.rtmToken.substring(0, 20) + '...',
                expiresAt: tokens.expiresAt,
                expiresIn: tokens.expiresAt - Math.floor(Date.now() / 1000),
                timestamp: new Date().toISOString()
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('[agora-diagnostics] Token generation error:', error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            }
          );
        }
      }
      
      default: {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unknown action: ${action}. Valid actions: echo, health, config, debug`
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        );
      }
    }
  } catch (error) {
    console.error('[agora-diagnostics] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
