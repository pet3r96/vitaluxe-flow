import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';

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
  
  try {
    const supabase = createAdminClient();

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { attemptId, code, phoneNumber } = await req.json();

    if (!attemptId || !code || !phoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // Log success
    const responseTime = Date.now() - startTime;
    await supabase.from('two_fa_audit_log').insert({
      attempt_id: attemptId,
      event_type: 'code_verified',
      code_verified: true,
      response_time_ms: responseTime,
      metadata: { provider }
    });

    console.log('[2FA Verify] Attempt:', attemptId, '| Success | Provider:', provider, '| Time:', responseTime, 'ms');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Phone number verified successfully',
        provider
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in verify-2fa-sms:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
