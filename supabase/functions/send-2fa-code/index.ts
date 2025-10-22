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

    // Send SMS via GHL (GoHighLevel) without creating contact
    const ghlApiKey = Deno.env.get('GHL_API_KEY');
    const ghlTollFreeNumber = Deno.env.get('GHL_TOLL_FREE_NUMBER');

    if (!ghlApiKey || !ghlTollFreeNumber) {
      console.error('GHL SMS credentials not configured');
      return new Response(
        JSON.stringify({ 
          error: 'SMS service not configured. Please contact support.',
          code // In development, return code for testing
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      // Send SMS via GHL API without creating a contact
      const smsResponse = await fetch(
        "https://services.leadconnectorhq.com/conversations/messages",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${ghlApiKey}`,
            "Content-Type": "application/json",
            "Version": "2021-07-28",
          },
          body: JSON.stringify({
            type: "SMS",
            contactPhone: phoneNumber,
            phone: ghlTollFreeNumber,
            message: `Your VitaLuxe verification code is: ${code}. This code expires in 10 minutes.`,
          }),
        }
      );

      if (!smsResponse.ok) {
        const errorText = await smsResponse.text();
        console.error('GHL SMS send failed:', errorText);
        throw new Error(`Failed to send SMS via GHL: ${errorText}`);
      }

      const responseData = await smsResponse.json();
      console.log(`2FA code sent to ${phoneNumber} for user ${user.id} via GHL (ID: ${responseData.messageId || 'unknown'})`);
    } catch (ghlError: any) {
      console.error('GHL SMS error:', ghlError);
      throw new Error(`Failed to send SMS: ${ghlError.message}`);
    }

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