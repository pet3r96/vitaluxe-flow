import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { edgeLogger } from '../_shared/logger.ts';

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
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  try {
    const supabase = createAdminClient();

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Twilio-only SMS provider
    edgeLogger.info('[2FA Twilio] Processing SMS verification');

    // Parse request body
    let { phoneNumber, purpose = 'verification' } = await req.json();

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phone number is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 2: Normalize phone number to E.164 format
    phoneNumber = phoneNumber.replace(/[-\s()]/g, '');
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+1' + phoneNumber;
    }

    // Validate phone number format (E.164 check)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber.replace(/[-\s]/g, ''))) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid phone number format. Use E.164 format (e.g., +15551234567)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 2 WEEK 4: Per-user rate limiting (5 SMS per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: userAttempts, error: userRateLimitError } = await supabase
      .from('sms_verification_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    if (userRateLimitError) {
      edgeLogger.error('[send-2fa-sms] User rate limit check failed', userRateLimitError, { userId: user.id });
      throw userRateLimitError;
    }

    if (userAttempts && userAttempts >= 5) {
      edgeLogger.warn('[send-2fa-sms] Per-user rate limit exceeded', { userId: user.id, attempts: userAttempts });
      return new Response(
        JSON.stringify({ 
          error: 'Too many verification attempts. Please try again in an hour.',
          attemptsRemaining: 0
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        user_id: user.id, // PHASE 2 WEEK 4: Track user for rate limiting
        code_hash: codeHash,
        expires_at: expiresAt,
        window_key: windowKey
      })
      .select('attempt_id')
      .single();

    // Handle idempotent duplicate (unique constraint violation on window_key)
    if (insertError?.code === '23505') {
      edgeLogger.info('[2FA Twilio] Idempotent duplicate detected', { userId: user.id, window: windowBucket });
      
      const { data: existingAttempt, error: fetchError } = await supabase
        .from('sms_verification_attempts')
        .select('attempt_id')
        .eq('window_key', windowKey)
        .single();

      if (fetchError || !existingAttempt) {
        edgeLogger.error('[2FA Twilio] Failed to fetch existing attempt', fetchError);
        throw new Error('Failed to retrieve verification attempt');
      }

      await supabase.from('two_fa_audit_log').insert({
        user_id: user.id,
        phone: phoneNumber,
        attempt_id: existingAttempt.attempt_id,
        event_type: 'duplicate_blocked',
        code_verified: false,
        metadata: { 
          purpose,
          reason: 'idempotent_window_key',
          provider: 'twilio'
        }
      });

      edgeLogger.info('[2FA Twilio] Idempotent duplicate blocked', { attemptId: existingAttempt.attempt_id });

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
      edgeLogger.error('[2FA Twilio] Attempt insert failed', insertError);
      throw new Error('Failed to create verification attempt');
    }

    const attemptId = attemptData.attempt_id;

    // ========== TWILIO SMS LOGIC ==========
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const twilioMessagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID')!;

    edgeLogger.info('[2FA Twilio] Sending SMS', { attemptId });
      
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

      edgeLogger.info('[2FA Twilio] Response received', { attemptId, status: twilioResponse.status, responseTimeMs: responseTime });

      if (!twilioResponse.ok) {
        const errorText = await twilioResponse.text();
        edgeLogger.error('[2FA Twilio] API failed', null, { attemptId, errorText });
        
        // For transient errors (5xx), treat as queued
        if (twilioResponse.status >= 500 && twilioResponse.status < 600) {
          await supabase.from('two_fa_audit_log').insert({
            user_id: user.id,
            phone: phoneNumber,
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
          edgeLogger.info('[2FA Twilio] Queued (5xx)', { attemptId, totalTimeMs: totalTime });

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
          user_id: user.id,
          phone: phoneNumber,
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
        user_id: user.id,
        phone: phoneNumber,
        attempt_id: attemptId,
        event_type: 'code_sent',
        code_verified: false,
        response_time_ms: responseTime,
        metadata: { purpose, provider: 'twilio' }
      });
      
      // PHASE 2: Audit logging for sms_sent
      const { error: auditError } = await supabase.from('audit_logs').insert({
        user_id: user.id,
        action_type: 'sms_sent',
        entity_type: 'sms_verification_attempts',
        entity_id: attemptId,
        ip_address: ipAddress,
        details: {
          phone_masked: phoneNumber.replace(/\d(?=\d{4})/g, '*'),
          provider: 'twilio',
          purpose
        }
      });
      
      if (auditError) {
        edgeLogger.error('[send-2fa-sms] Failed to log audit event', auditError);
      }


      const totalTime = Date.now() - startTime;
      edgeLogger.info('[2FA Twilio] Success', { attemptId, totalTimeMs: totalTime });

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
        edgeLogger.info('[2FA Twilio] Timeout after 12s, treating as queued', { attemptId });
        
        await supabase.from('two_fa_audit_log').insert({
          user_id: user.id,
          phone: phoneNumber,
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
    edgeLogger.info('[2FA Twilio] Queued (timeout)', { attemptId, totalTimeMs: totalTime });

        // PHASE 2: Audit logging for sms_sent
        const { error: auditError } = await supabase.from('audit_logs').insert({
          user_id: user.id,
          user_email: user.email,
          action_type: 'sms_sent',
          entity_type: 'sms_verification_attempts',
          entity_id: attemptId,
          ip_address: ipAddress,
          details: {
            phone_masked: phoneNumber.replace(/\d(?=\d{4})/g, '*'),
            purpose,
            queued: true,
            timestamp: new Date().toISOString()
          }
        });

        if (auditError) {
          edgeLogger.error('Failed to log audit event', auditError);
        }

        // PHASE 2: Structured logging
        edgeLogger.logOperation({
          user_id: user.id,
          ip_address: ipAddress,
          operation: 'send_2fa_sms',
          success: true,
          duration_ms: Date.now() - startTime,
          metadata: { attemptId, queued: true }
        });

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
    // PHASE 2: Log operation failure
    edgeLogger.logOperation({
      user_id: undefined,
      ip_address: ipAddress,
      operation: 'send_2fa_sms',
      success: false,
      duration_ms: Date.now() - startTime,
      metadata: { error: error.message || 'Internal server error' }
    });

    edgeLogger.error('Error in send-2fa-sms', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
