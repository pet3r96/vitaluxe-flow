import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    console.log(`[verify-ghl-sms] User authenticated: ${user.id}`);

    const { code } = await req.json();

    if (!code || code.length !== 6) {
      throw new Error('Valid 6-digit code is required');
    }

    // Find the most recent non-expired, non-verified code for this user
    const { data: codeData, error: codeError } = await supabase
      .from('sms_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (codeError) throw codeError;

    console.log(`[verify-ghl-sms] Code lookup result:`, { 
      found: !!codeData, 
      expired: codeData ? new Date(codeData.expires_at) < new Date() : null,
      attemptCount: codeData?.attempt_count
    });

    if (!codeData) {
      await supabase.from('two_fa_audit_log').insert({
        user_id: user.id,
        event_type: 'code_failed',
        phone: 'unknown',
        code_verified: false,
        metadata: { reason: 'no_valid_code' }
      });

      return new Response(
        JSON.stringify({ 
          error: 'No valid verification code found. Please request a new code.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check attempt count
    if (codeData.attempt_count >= 5) {
      await supabase.from('two_fa_audit_log').insert({
        user_id: user.id,
        event_type: 'code_failed',
        phone: codeData.phone,
        code_verified: false,
        attempt_count: codeData.attempt_count,
        metadata: { reason: 'max_attempts_exceeded' }
      });

      return new Response(
        JSON.stringify({ 
          error: 'Maximum verification attempts exceeded. Please request a new code.',
          attemptsRemaining: 0
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment attempt count
    const { error: updateAttemptError } = await supabase
      .from('sms_codes')
      .update({ attempt_count: codeData.attempt_count + 1 })
      .eq('id', codeData.id);

    if (updateAttemptError) throw updateAttemptError;

    // Verify code
    if (codeData.code !== code) {
      const attemptsRemaining = 5 - (codeData.attempt_count + 1);
      
      await supabase.from('two_fa_audit_log').insert({
        user_id: user.id,
        event_type: 'code_failed',
        phone: codeData.phone,
        code_verified: false,
        attempt_count: codeData.attempt_count + 1,
        metadata: { attempts_remaining: attemptsRemaining }
      });

      return new Response(
        JSON.stringify({ 
          error: `Invalid verification code. ${attemptsRemaining} ${attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining.`,
          attemptsRemaining
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark code as verified
    const now = new Date().toISOString();
    const { error: verifyError } = await supabase
      .from('sms_codes')
      .update({ 
        verified: true, 
        verified_at: now
      })
      .eq('id', codeData.id);

    if (verifyError) throw verifyError;

    // Update or create user_2fa_settings
    const { data: existingSettings } = await supabase
      .from('user_2fa_settings')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingSettings) {
      console.log(`[verify-ghl-sms] Updating existing user_2fa_settings for user ${user.id}`);
      
      // Update existing settings
      const { error: updateError } = await supabase
        .from('user_2fa_settings')
        .update({
          ghl_enabled: true,
          ghl_phone_verified: true,
          last_ghl_verification: now,
          phone_number: codeData.phone,
          phone_verified: true,
          is_enrolled: true
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[verify-ghl-sms] Update failed:', updateError);
        throw updateError;
      }
      console.log(`[verify-ghl-sms] Successfully updated user_2fa_settings`);
    } else {
      console.log(`[verify-ghl-sms] Inserting new user_2fa_settings for user ${user.id}`);
      
      // Insert new settings
      const { error: insertError } = await supabase
        .from('user_2fa_settings')
        .insert({
          user_id: user.id,
          phone_number: codeData.phone,
          ghl_enabled: true,
          ghl_phone_verified: true,
          last_ghl_verification: now,
          phone_verified: true,
          is_enrolled: true
        });

      if (insertError) {
        console.error('[verify-ghl-sms] Insert failed:', insertError);
        throw insertError;
      }
      console.log(`[verify-ghl-sms] Successfully inserted user_2fa_settings`);
    }

    // Log successful verification
    await supabase.from('two_fa_audit_log').insert({
      user_id: user.id,
      event_type: 'code_verified',
      phone: codeData.phone,
      code_verified: true,
      attempt_count: codeData.attempt_count + 1
    });

    console.log(`SMS code verified for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Phone number verified successfully',
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in verify-ghl-sms:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});