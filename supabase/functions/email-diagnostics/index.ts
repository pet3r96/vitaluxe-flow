import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action = 'health', recipient } = await req.json().catch(() => ({}));
    
    const postmarkApiKey = Deno.env.get('POSTMARK_API_KEY') || '';
    const postmarkFromEmail = Deno.env.get('POSTMARK_FROM_EMAIL') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    
    switch (action) {
      case 'health': {
        // Health check - verify email configuration
        const diagnostics = {
          timestamp: new Date().toISOString(),
          postmarkApiKey: postmarkApiKey ? 'configured' : 'missing',
          postmarkFromEmail: postmarkFromEmail ? 'configured' : 'missing',
          supabaseUrl: supabaseUrl ? 'configured' : 'missing',
          recommendation: ''
        };
        
        // Determine overall health status
        const allConfigured = postmarkApiKey && postmarkFromEmail && supabaseUrl;
        diagnostics.recommendation = allConfigured 
          ? 'All email configurations are present'
          : 'Missing required email configuration';
        
        // Test Postmark API connectivity if configured
        if (postmarkApiKey) {
          try {
            const testResponse = await fetch('https://api.postmarkapp.com/server', {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'X-Postmark-Server-Token': postmarkApiKey
              }
            });
            
            const responseData = await testResponse.json();
            
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  ...diagnostics,
                  postmarkStatus: testResponse.ok ? 'connected' : 'error',
                  postmarkServer: responseData.Name || 'unknown',
                  status: testResponse.ok && allConfigured ? 'healthy' : 'degraded'
                }
              }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: testResponse.ok && allConfigured ? 200 : 503
              }
            );
          } catch (error) {
          const { edgeLogger } = await import('../_shared/logger.ts');
          edgeLogger.error('[email-diagnostics] Postmark connectivity test failed', error);
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  ...diagnostics,
                  postmarkStatus: 'unreachable',
                  error: error instanceof Error ? error.message : String(error),
                  status: 'unhealthy'
                }
              }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 503
              }
            );
          }
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...diagnostics,
              status: allConfigured ? 'configured' : 'incomplete'
            }
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: allConfigured ? 200 : 503
          }
        );
      }
      
      case 'test': {
        // Send test email
        if (!recipient || !recipient.includes('@')) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Valid recipient email address is required for test action'
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            }
          );
        }
        
        if (!postmarkApiKey || !postmarkFromEmail) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Email configuration incomplete. Missing POSTMARK_API_KEY or POSTMARK_FROM_EMAIL'
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            }
          );
        }
        
        try {
          const emailResponse = await fetch('https://api.postmarkapp.com/email', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-Postmark-Server-Token': postmarkApiKey
            },
            body: JSON.stringify({
              From: postmarkFromEmail,
              To: recipient,
              Subject: 'VitaLuxe Email Diagnostics Test',
              TextBody: `This is a test email from VitaLuxe email diagnostics.\n\nTimestamp: ${new Date().toISOString()}\n\nIf you received this, your email configuration is working correctly.`,
              HtmlBody: `<p>This is a test email from VitaLuxe email diagnostics.</p><p><strong>Timestamp:</strong> ${new Date().toISOString()}</p><p>If you received this, your email configuration is working correctly.</p>`
            })
          });
          
          const emailData = await emailResponse.json();
          
          if (!emailResponse.ok) {
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Failed to send test email',
                details: emailData
              }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: emailResponse.status
              }
            );
          }
          
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                sent: true,
                recipient,
                messageId: emailData.MessageID,
                timestamp: new Date().toISOString()
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('[email-diagnostics] Test email error:', error);
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
            error: `Unknown action: ${action}. Valid actions: health, test`
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        );
      }
    }
  } catch (error) {
    console.error('[email-diagnostics] Error:', error);
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
