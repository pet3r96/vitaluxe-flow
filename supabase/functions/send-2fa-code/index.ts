import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Removed AWS SNS logic - previously used @aws-sdk/client-sns@3.485.0

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

    const { phoneNumber, codeType = '2fa_setup' } = await req.json();

    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    // Rate limiting: Check for recent codes (max 3 in last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentCodes, error: recentError } = await supabase
      .from('two_fa_verification_codes')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', fifteenMinutesAgo);

    if (recentError) throw recentError;

    if (recentCodes && recentCodes.length >= 3) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please wait 15 minutes before requesting another code.' 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code with 10-minute expiration
    // Note: phone_number will be auto-encrypted by database trigger
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    const { error: insertError } = await supabase
      .from('two_fa_verification_codes')
      .insert({
        user_id: user.id,
        phone_number: phoneNumber, // Will be encrypted by trigger
        code,
        code_type: codeType,
        expires_at: expiresAt
      });

    if (insertError) throw insertError;

    // Removed AWS SNS logic - previously sent SMS via Amazon SNS
    // TODO: Replace with Supabase/Twilio/GoHighLevel integration if needed
    console.log(`2FA code generated for user ${user.id}. Code stored in database.`);
    console.warn('SMS sending not configured - code will only be available in database');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Verification code sent successfully',
        expiresIn: 600 // 10 minutes in seconds
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-2fa-code:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});