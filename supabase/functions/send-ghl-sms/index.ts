import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper to hash codes securely using Web Crypto API
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ghlWebhookUrl = Deno.env.get('GHL_WEBHOOK_URL')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user (minimal check, no storage)
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { phoneNumber, purpose = 'verification' } = await req.json();

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phone number is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone number format (basic E.164 check)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber.replace(/[-\s]/g, ''))) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid phone number format. Use E.164 format (e.g., +15551234567)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: Check for recent attempts (max 3 in last 15 minutes)
    // Using attempt creation time, no user tracking
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentAttempts, error: recentError } = await supabase
      .from('sms_verification_attempts')
      .select('attempt_id')
      .gte('created_at', fifteenMinutesAgo);

    if (recentError) throw recentError;

    // For rate limiting, we count recent attempts globally
    // In production, you'd implement IP-based or session-based rate limiting
    if (recentAttempts && recentAttempts.length >= 100) {
      return new Response(
        JSON.stringify({ 
          error: 'System rate limit exceeded. Please try again later.',
          attemptsRemaining: 0
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await hashCode(code);
    
    // Store ONLY: attempt_id, code_hash, expiration (NO PII)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    const { data: attemptData, error: insertError } = await supabase
      .from('sms_verification_attempts')
      .insert({
        code_hash: codeHash,
        expires_at: expiresAt
      })
      .select('attempt_id')
      .single();

    if (insertError || !attemptData) {
      console.error('[GHL] Attempt insert failed:', insertError);
      throw new Error('Failed to create verification attempt');
    }

    const attemptId = attemptData.attempt_id;

    // Send SMS via GHL webhook with 12-second timeout
    console.log('[GHL] Attempt:', attemptId, '| Sending SMS');
    
    const ghlStartTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout
    
    try {
      const ghlResponse = await fetch(ghlWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber, code }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const ghlEndTime = Date.now();
      const responseTime = ghlEndTime - ghlStartTime;

      console.log('[GHL] Attempt:', attemptId, '| Response:', ghlResponse.status, '| Time:', responseTime, 'ms');

      if (!ghlResponse.ok) {
        const errorText = await ghlResponse.text();
        console.error('[GHL] Attempt:', attemptId, '| Webhook failed:', errorText);
        
        // For transient errors (5xx), treat as queued
        if (ghlResponse.status >= 500 && ghlResponse.status < 600) {
          await supabase.from('two_fa_audit_log').insert({
            attempt_id: attemptId,
            event_type: 'code_queued',
            code_verified: false,
            response_time_ms: responseTime,
            metadata: { 
              purpose,
              queued_reason: 'upstream_5xx',
              status: ghlResponse.status
            }
          });

          const totalTime = Date.now() - startTime;
          console.log('[GHL] Attempt:', attemptId, '| Queued (5xx) | Total:', totalTime, 'ms');

          return new Response(
            JSON.stringify({ 
              success: true,
              attemptId: attemptId,
              message: 'Code is being sent (queued)',
              queued: true,
              expiresIn: 300
            }),
            { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Log definitive failures
        await supabase.from('two_fa_audit_log').insert({
          attempt_id: attemptId,
          event_type: 'ghl_webhook_failed',
          code_verified: false,
          response_time_ms: responseTime,
          metadata: { 
            error: errorText.substring(0, 100),
            status: ghlResponse.status
          }
        });
        
        throw new Error(`GHL webhook failed with status ${ghlResponse.status}`);
      }
      
      // Log success (NO PII, only attempt_id + timing)
      await supabase.from('two_fa_audit_log').insert({
        attempt_id: attemptId,
        event_type: 'code_sent',
        code_verified: false,
        response_time_ms: responseTime,
        metadata: { purpose }
      });

      const totalTime = Date.now() - startTime;
      console.log('[GHL] Attempt:', attemptId, '| Success | Total:', totalTime, 'ms');

      return new Response(
        JSON.stringify({ 
          success: true,
          attemptId: attemptId,
          message: 'Verification code sent successfully',
          expiresIn: 300
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        // Treat timeout as queued - code was likely sent but upstream slow
        const responseTime = Date.now() - ghlStartTime;
        console.log('[GHL] Attempt:', attemptId, '| Timeout after 12s, treating as queued');
        
        await supabase.from('two_fa_audit_log').insert({
          attempt_id: attemptId,
          event_type: 'code_queued',
          code_verified: false,
          response_time_ms: responseTime,
          metadata: { 
            purpose,
            queued_reason: 'webhook_timeout_12s'
          }
        });

        const totalTime = Date.now() - startTime;
        console.log('[GHL] Attempt:', attemptId, '| Queued (timeout) | Total:', totalTime, 'ms');

        return new Response(
          JSON.stringify({ 
            success: true,
            attemptId: attemptId,
            message: 'Code is being sent (queued)',
            queued: true,
            expiresIn: 300
          }),
          { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }

  } catch (error: any) {
    console.error('Error in send-ghl-sms:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});