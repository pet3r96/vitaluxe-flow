import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper to hash codes securely
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Unified 2FA SMS Sender (Consolidated)
 * Routes to Twilio or GHL based on system_settings.sms_provider
 * All logic is inline to eliminate nested edge function calls
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Twilio-only SMS provider
    console.log('[2FA Twilio] Processing SMS verification');

    // Parse request body
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

    // Rate limiting: Check for recent attempts (max 100 in last 15 minutes globally)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentAttempts, error: recentError } = await supabase
      .from('sms_verification_attempts')
      .select('attempt_id')
      .gte('created_at', fifteenMinutesAgo);

    if (recentError) throw recentError;

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
    
    // IDEMPOTENCY: Compute window_key (10s buckets) to prevent duplicate SMS sends
    const windowBucket = Math.floor(Date.now() / 10000);
    const phoneSanitized = phoneNumber.replace(/[-\s]/g, '');
    const phoneHash = await hashCode(phoneSanitized);
    const rawKey = `${user.id}:${windowBucket}:${phoneHash}:${purpose}`;
    const windowKey = await hashCode(rawKey);
    
    // Store ONLY: attempt_id, code_hash, expiration, window_key (NO PII)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    const { data: attemptData, error: insertError } = await supabase
      .from('sms_verification_attempts')
      .insert({
        code_hash: codeHash,
        expires_at: expiresAt,
        window_key: windowKey
      })
      .select('attempt_id')
      .single();

    // Handle idempotent duplicate (unique constraint violation on window_key)
    if (insertError?.code === '23505') {
      console.log('[2FA Twilio] Idempotent duplicate detected | User:', user.id, '| Window:', windowBucket);
      
      const { data: existingAttempt, error: fetchError } = await supabase
        .from('sms_verification_attempts')
        .select('attempt_id')
        .eq('window_key', windowKey)
        .single();

      if (fetchError || !existingAttempt) {
        console.error('[2FA Twilio] Failed to fetch existing attempt:', fetchError);
        throw new Error('Failed to retrieve verification attempt');
      }

      await supabase.from('two_fa_audit_log').insert({
        attempt_id: existingAttempt.attempt_id,
        event_type: 'duplicate_blocked',
        code_verified: false,
        metadata: { 
          purpose,
          reason: 'idempotent_window_key',
          provider: 'twilio'
        }
      });

      console.log('[2FA Twilio] Idempotent duplicate blocked | Attempt:', existingAttempt.attempt_id);

      return new Response(
        JSON.stringify({ 
          success: true,
          attemptId: existingAttempt.attempt_id,
          message: 'Using recent verification attempt',
          expiresIn: 300,
          deduplicated: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (insertError || !attemptData) {
      console.error('[2FA Twilio] Attempt insert failed:', insertError);
      throw new Error('Failed to create verification attempt');
    }

    const attemptId = attemptData.attempt_id;

    // ========== TWILIO SMS LOGIC ==========
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const twilioMessagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID')!;

    console.log('[2FA Twilio] Attempt:', attemptId, '| Sending SMS');
      
    const twilioStartTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout
    
    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
      
      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: { 
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          MessagingServiceSid: twilioMessagingServiceSid,
          To: phoneNumber,
          Body: `Your VitaLuxe verification code is: ${code}. This code expires in 5 minutes. Do not share this code.`
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const twilioEndTime = Date.now();
      const responseTime = twilioEndTime - twilioStartTime;

      console.log('[2FA Twilio] Attempt:', attemptId, '| Response:', twilioResponse.status, '| Time:', responseTime, 'ms');

      if (!twilioResponse.ok) {
        const errorText = await twilioResponse.text();
        console.error('[2FA Twilio] Attempt:', attemptId, '| API failed:', errorText);
        
        // For transient errors (5xx), treat as queued
        if (twilioResponse.status >= 500 && twilioResponse.status < 600) {
          await supabase.from('two_fa_audit_log').insert({
            attempt_id: attemptId,
            event_type: 'code_queued',
            code_verified: false,
            response_time_ms: responseTime,
            metadata: { 
              purpose,
              queued_reason: 'upstream_5xx',
              status: twilioResponse.status,
              provider: 'twilio'
            }
          });

          const totalTime = Date.now() - startTime;
          console.log('[2FA Twilio] Attempt:', attemptId, '| Queued (5xx) | Total:', totalTime, 'ms');

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
          event_type: 'twilio_api_failed',
          code_verified: false,
          response_time_ms: responseTime,
          metadata: { 
            error: errorText.substring(0, 100),
            status: twilioResponse.status,
            provider: 'twilio'
          }
        });
        
        throw new Error(`Twilio API failed with status ${twilioResponse.status}`);
      }
      
      // Log success
      await supabase.from('two_fa_audit_log').insert({
        attempt_id: attemptId,
        event_type: 'code_sent',
        code_verified: false,
        response_time_ms: responseTime,
        metadata: { purpose, provider: 'twilio' }
      });

      const totalTime = Date.now() - startTime;
      console.log('[2FA Twilio] Attempt:', attemptId, '| Success | Total:', totalTime, 'ms');

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
        const responseTime = Date.now() - twilioStartTime;
        console.log('[2FA Twilio] Attempt:', attemptId, '| Timeout after 12s, treating as queued');
        
        await supabase.from('two_fa_audit_log').insert({
          attempt_id: attemptId,
          event_type: 'code_queued',
          code_verified: false,
          response_time_ms: responseTime,
          metadata: { 
            purpose,
            queued_reason: 'api_timeout_12s',
            provider: 'twilio'
          }
        });

        const totalTime = Date.now() - startTime;
        console.log('[2FA Twilio] Attempt:', attemptId, '| Queued (timeout) | Total:', totalTime, 'ms');

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
    console.error('Error in send-2fa-sms:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
