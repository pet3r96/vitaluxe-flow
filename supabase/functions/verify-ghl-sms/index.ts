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
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user (minimal check, no storage)
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse and log request body for debugging
    const requestBody = await req.json();
    console.log('[GHL] Verify | Raw request body:', JSON.stringify(requestBody));

    const { code, attemptId, phoneNumber } = requestBody;
    console.log('[GHL] Verify | Parsed values:', { 
      code: code ? '***' : null, 
      attemptId, 
      phoneNumber: phoneNumber ? phoneNumber.substring(0, 5) + '***' : null 
    });

    if (!code || code.length !== 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid 6-digit code is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!attemptId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Verification session expired. Please request a new code.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phone number is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[GHL] Verify | Attempt:', attemptId);

    // Find the attempt by attemptId (NO PII lookup needed)
    const { data: attemptData, error: attemptError } = await supabase
      .from('sms_verification_attempts')
      .select('*')
      .eq('attempt_id', attemptId)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (attemptError) throw attemptError;

    console.log('[GHL] Verify | Attempt:', attemptId, '| Found:', !!attemptData, '| AttemptCount:', attemptData?.attempt_count);

    if (!attemptData) {
      await supabase.from('two_fa_audit_log').insert({
        attempt_id: attemptId,
        event_type: 'code_failed',
        code_verified: false,
        response_time_ms: Date.now() - startTime,
        metadata: { reason: 'no_valid_attempt' }
      });

      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No valid verification attempt found. Please request a new code.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check attempt count
    if (attemptData.attempt_count >= 5) {
      await supabase.from('two_fa_audit_log').insert({
        attempt_id: attemptId,
        event_type: 'code_failed',
        code_verified: false,
        attempt_count: attemptData.attempt_count,
        response_time_ms: Date.now() - startTime,
        metadata: { reason: 'max_attempts_exceeded' }
      });

      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Maximum verification attempts exceeded. Please request a new code.',
          attemptsRemaining: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment attempt count
    const { error: updateAttemptError } = await supabase
      .from('sms_verification_attempts')
      .update({ attempt_count: attemptData.attempt_count + 1 })
      .eq('attempt_id', attemptId);

    if (updateAttemptError) throw updateAttemptError;

    // Verify code by comparing hash
    const submittedCodeHash = await hashCode(code);
    
    if (attemptData.code_hash !== submittedCodeHash) {
      const attemptsRemaining = 5 - (attemptData.attempt_count + 1);
      
      await supabase.from('two_fa_audit_log').insert({
        attempt_id: attemptId,
        event_type: 'code_failed',
        code_verified: false,
        attempt_count: attemptData.attempt_count + 1,
        response_time_ms: Date.now() - startTime,
        metadata: { attempts_remaining: attemptsRemaining }
      });

      console.log('[GHL] Verify | Attempt:', attemptId, '| Failed | Remaining:', attemptsRemaining);

      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Invalid verification code. ${attemptsRemaining} ${attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining.`,
          attemptsRemaining
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark attempt as verified
    const now = new Date().toISOString();
    const { error: verifyError } = await supabase
      .from('sms_verification_attempts')
      .update({ 
        verified: true, 
        verified_at: now
      })
      .eq('attempt_id', attemptId);

    if (verifyError) throw verifyError;

    // Update or create user_2fa_settings (minimal linking with user_id)
    // Note: This is the only place we link attempt to user for 2FA enrollment
    const { data: existingSettings } = await supabase
      .from('user_2fa_settings')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingSettings) {
      console.log('[GHL] Verify | Attempt:', attemptId, '| Updating 2FA settings for user');
      
      const { error: updateError } = await supabase
        .from('user_2fa_settings')
        .update({
          phone_number: phoneNumber,
          ghl_enabled: true,
          ghl_phone_verified: true,
          last_ghl_verification: now,
          phone_verified: true,
          is_enrolled: true
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[GHL] Verify | Attempt:', attemptId, '| Update failed:', updateError);
        throw updateError;
      }
    } else {
      console.log('[GHL] Verify | Attempt:', attemptId, '| Creating 2FA settings for user');
      
      const { error: insertError } = await supabase
        .from('user_2fa_settings')
        .insert({
          user_id: user.id,
          phone_number: phoneNumber,
          ghl_enabled: true,
          ghl_phone_verified: true,
          last_ghl_verification: now,
          phone_verified: true,
          is_enrolled: true
        });

      if (insertError) {
        console.error('[GHL] Verify | Attempt:', attemptId, '| Insert failed:', insertError);
        throw insertError;
      }
    }

    // Log successful verification (NO PII)
    const totalTime = Date.now() - startTime;
    await supabase.from('two_fa_audit_log').insert({
      attempt_id: attemptId,
      event_type: 'code_verified',
      code_verified: true,
      attempt_count: attemptData.attempt_count + 1,
      response_time_ms: totalTime
    });

    console.log('[GHL] Verify | Attempt:', attemptId, '| Success | Total:', totalTime, 'ms');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Phone number verified successfully',
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error('[GHL] Verify | Error:', error, '| Time:', totalTime, 'ms');
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
