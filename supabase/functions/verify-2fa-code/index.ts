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

    const { code, phoneNumber } = await req.json();

    if (!code || !phoneNumber) {
      throw new Error('Code and phone number are required');
    }

    // Find the most recent non-expired, non-verified code for this user
    const { data: codeData, error: codeError } = await supabase
      .from('two_fa_verification_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('phone_number', phoneNumber)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (codeError) throw codeError;

    if (!codeData) {
      return new Response(
        JSON.stringify({ 
          error: 'No valid verification code found. Please request a new code.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check attempt count
    if (codeData.attempts >= 5) {
      return new Response(
        JSON.stringify({ 
          error: 'Maximum verification attempts exceeded. Please request a new code.' 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment attempt count
    const { error: updateAttemptError } = await supabase
      .from('two_fa_verification_codes')
      .update({ attempts: codeData.attempts + 1 })
      .eq('id', codeData.id);

    if (updateAttemptError) throw updateAttemptError;

    // Verify code
    if (codeData.code !== code) {
      const attemptsRemaining = 5 - (codeData.attempts + 1);
      return new Response(
        JSON.stringify({ 
          error: `Invalid verification code. ${attemptsRemaining} attempts remaining.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark code as verified
    const { error: verifyError } = await supabase
      .from('two_fa_verification_codes')
      .update({ 
        verified: true, 
        verified_at: new Date().toISOString() 
      })
      .eq('id', codeData.id);

    if (verifyError) throw verifyError;

    // Update or create user_2fa_settings
    const now = new Date().toISOString();
    const { data: existingSettings } = await supabase
      .from('user_2fa_settings')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingSettings) {
      // Update existing settings
      const { error: updateError } = await supabase
        .from('user_2fa_settings')
        .update({
          phone_number: phoneNumber,
          phone_verified: true,
          phone_verified_at: now,
          is_enrolled: true,
          enrolled_at: now,
          last_verified_at: now
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    } else {
      // Insert new settings
      const { error: insertError } = await supabase
        .from('user_2fa_settings')
        .insert({
          user_id: user.id,
          phone_number: phoneNumber,
          phone_verified: true,
          phone_verified_at: now,
          is_enrolled: true,
          enrolled_at: now,
          last_verified_at: now
        });

      if (insertError) throw insertError;
    }

    console.log(`2FA verified for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Phone number verified successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in verify-2fa-code:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});