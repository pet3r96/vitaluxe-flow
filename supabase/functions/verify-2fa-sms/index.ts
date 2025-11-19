import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateRequestSize } from '../_shared/requestSizeValidator.ts';

// Helper to hash codes securely
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Provider-agnostic 2FA SMS Verification
 * Works with codes sent by either Twilio or GHL
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  
  try {
    const supabase = createAdminClient();

    // PHASE 3: Request size validation
    const sizeCheckResponse = validateRequestSize(req, 'verify-2fa-sms', corsHeaders);
    if (sizeCheckResponse) return sizeCheckResponse;

    // PHASE 3: Rate limiting (10 attempts per 15 min per IP)
    const limiter = new RateLimiter();
    const clientIP = getClientIP(req);
    const { allowed } = await limiter.checkLimit(
      supabase,
      clientIP,
      'verify-2fa-sms',
      { maxRequests: 10, windowSeconds: 900 }
    );

    if (!allowed) {
      edgeLogger.warn('2FA verification rate limit exceeded', { clientIP });
      return new Response(
        JSON.stringify({ success: false, error: 'Too many verification attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    let { attemptId, code, phoneNumber } = await req.json();

    if (!attemptId || !code || !phoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 2: Normalize phone number to E.164 format
    phoneNumber = phoneNumber.replace(/[-\s()]/g, '');
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+1' + phoneNumber;
    }

    // Validate code format
    if (!/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid code format' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current provider
    const { data: providerSetting } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'sms_provider')
      .single();

    const provider = providerSetting?.setting_value?.replace(/"/g, '') || 'twilio';

    // Fetch attempt with verification check
    const { data: attempt, error: fetchError } = await supabase
      .from('sms_verification_attempts')
      .select('attempt_id, code_hash, expires_at, verified_at')
      .eq('attempt_id', attemptId)
      .single();

    if (fetchError || !attempt) {
      await supabase.from('two_fa_audit_log').insert({
        user_id: user.id,
        phone: phoneNumber,
        attempt_id: attemptId,
        event_type: 'verification_failed',
        code_verified: false,
        metadata: { error: 'attempt_not_found', provider }
      });
      
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid verification attempt' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already verified
    if (attempt.verified_at) {
      await supabase.from('two_fa_audit_log').insert({
        user_id: user.id,
        phone: phoneNumber,
        attempt_id: attemptId,
        event_type: 'verification_failed',
        code_verified: false,
        metadata: { error: 'already_verified', provider }
      });
      
      return new Response(
        JSON.stringify({ success: false, error: 'Code already used' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    const expiresAt = new Date(attempt.expires_at);
    const now = new Date();
    if (now > expiresAt) {
      await supabase.from('two_fa_audit_log').insert({
        user_id: user.id,
        phone: phoneNumber,
        attempt_id: attemptId,
        event_type: 'verification_failed',
        code_verified: false,
        metadata: { error: 'code_expired', provider }
      });
      
      return new Response(
        JSON.stringify({ success: false, error: 'Verification code has expired' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify code hash
    const codeHash = await hashCode(code);
    if (codeHash !== attempt.code_hash) {
      await supabase.from('two_fa_audit_log').insert({
        user_id: user.id,
        phone: phoneNumber,
        attempt_id: attemptId,
        event_type: 'verification_failed',
        code_verified: false,
        metadata: { error: 'invalid_code', provider }
      });
      
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid verification code' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark attempt as verified
    const verifiedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('sms_verification_attempts')
      .update({ verified_at: verifiedAt })
      .eq('attempt_id', attemptId);

    if (updateError) throw updateError;

    // Update user 2FA settings based on current provider
    const { data: existingSettings } = await supabase
      .from('user_2fa_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const updateData: any = {
      phone_number: phoneNumber,
      phone_verified: true,
      is_enrolled: true,
      enrolled_at: existingSettings?.enrolled_at || verifiedAt,
      updated_at: verifiedAt
    };

    // Update provider-specific columns
    if (provider === 'twilio') {
      updateData.twilio_enabled = true;
      updateData.twilio_phone_verified = true;
      updateData.last_twilio_verification = verifiedAt;
    } else if (provider === 'ghl') {
      updateData.ghl_enabled = true;
      updateData.ghl_phone_verified = true;
      updateData.last_ghl_verification = verifiedAt;
    }

    // PHASE 2: Revoke all sessions after phone change (security requirement)
    try {
      const { error: revokeError } = await supabase.functions.invoke('revoke-user-sessions', {
        body: {
          userId: user.id,
          reason: 'phone_change'
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (revokeError) {
        edgeLogger.warn('Failed to revoke sessions after phone change', { error: revokeError });
      } else {
        edgeLogger.info('Successfully revoked all sessions after phone change', {
          userId: user.id
        });
      }
    } catch (err) {
      edgeLogger.error('Error invoking revoke-user-sessions', err as Error);
    }

    if (existingSettings) {
      const { error: settingsError } = await supabase
        .from('user_2fa_settings')
        .update(updateData)
        .eq('user_id', user.id);

      if (settingsError) throw settingsError;
    } else {
      const { error: insertError } = await supabase
        .from('user_2fa_settings')
        .insert({ user_id: user.id, ...updateData });

      if (insertError) throw insertError;
    }

    // Log success with detailed settings info
    edgeLogger.info('[2FA Verify] Settings updated', {
      hasUserId: !!user.id,
      provider,
      isEnrolled: true,
      phoneVerified: true,
      providerEnabled: provider === 'twilio' ? 'twilio_enabled=true' : 'ghl_enabled=true'
    });

    const responseTime = Date.now() - startTime;
    
    // Return confirmation payload so client can trust server state
    const confirmation = {
      success: true,
      is_enrolled: true,
      phone_verified: true,
      provider_enabled: provider,
      message: 'Verification successful'
    };
    await supabase.from('two_fa_audit_log').insert({
      user_id: user.id,
      phone: phoneNumber,
      attempt_id: attemptId,
      event_type: 'code_verified',
      code_verified: true,
      response_time_ms: responseTime,
      metadata: { provider }
    });

    edgeLogger.info('[2FA Verify] Attempt verified', { 
      hasAttemptId: !!attemptId,
      provider, 
      responseTimeMs: responseTime 
    });

    // PHASE 2: Audit logging for sms_verified
    const { error: auditError } = await supabase.from('audit_logs').insert({
      user_id: user.id,
      action_type: 'sms_verified',
      entity_type: 'sms_verification_attempts',
      entity_id: attemptId,
      ip_address: ipAddress,
      details: {
        phone_masked: phoneNumber.replace(/\d(?=\d{4})/g, '*'),
        verified_at: new Date().toISOString(),
        provider
      }
    });

    if (auditError) {
      edgeLogger.error('Failed to log audit event', auditError);
    }

    // PHASE 2: Structured logging
    edgeLogger.logOperation({
      user_id: user.id,
      ip_address: ipAddress,
      operation: 'verify_2fa_sms',
      success: true,
      duration_ms: Date.now() - startTime,
      metadata: { attemptId, provider }
    });

    return successResponse(confirmation);

  } catch (error: any) {
    // PHASE 2: Log operation failure
    edgeLogger.logOperation({
      user_id: undefined,
      ip_address: ipAddress,
      operation: 'verify_2fa_sms',
      success: false,
      duration_ms: Date.now() - startTime,
      metadata: { error: error.message || 'Internal server error' }
    });

    edgeLogger.error('Error in verify-2fa-sms', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
