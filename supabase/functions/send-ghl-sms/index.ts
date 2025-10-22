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
    const ghlWebhookUrl = Deno.env.get('GHL_WEBHOOK_URL')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { phoneNumber, purpose = 'verification' } = await req.json();

    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    // Validate phone number format (basic E.164 check)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber.replace(/[-\s]/g, ''))) {
      throw new Error('Invalid phone number format. Use E.164 format (e.g., +15551234567)');
    }

    // Rate limiting: Check for recent codes (max 3 in last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentCodes, error: recentError } = await supabase
      .from('sms_codes')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', fifteenMinutesAgo);

    if (recentError) throw recentError;

    if (recentCodes && recentCodes.length >= 3) {
      // Log rate limit event
      await supabase.from('two_fa_audit_log').insert({
        user_id: user.id,
        event_type: 'rate_limited',
        phone: phoneNumber,
        metadata: { attempts: recentCodes.length }
      });

      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please wait 15 minutes before requesting another code.',
          attemptsRemaining: 0
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code with 5-minute expiration
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    const { error: insertError } = await supabase
      .from('sms_codes')
      .insert({
        user_id: user.id,
        phone: phoneNumber,
        code,
        expires_at: expiresAt
      });

    if (insertError) throw insertError;

    // Send SMS via GHL webhook (no signature required)
    console.log('[GHL SMS] Sending code to phone:', phoneNumber.slice(-4), 'for user:', user.id);
    console.log('[GHL SMS] Webhook URL:', ghlWebhookUrl);
    console.log('[GHL SMS] Payload:', JSON.stringify({ phone: phoneNumber, code: '[REDACTED]' }));
    
    const ghlStartTime = Date.now();
    const ghlResponse = await fetch(ghlWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone: phoneNumber, code })
    });
    const ghlEndTime = Date.now();

    console.log('[GHL SMS] Response status:', ghlResponse.status);
    console.log('[GHL SMS] Response time:', (ghlEndTime - ghlStartTime), 'ms');

    if (!ghlResponse.ok) {
      const errorText = await ghlResponse.text();
      console.error('[GHL SMS] Webhook failed:', errorText);
      
      // Log failure to audit
      await supabase.from('two_fa_audit_log').insert({
        user_id: user.id,
        event_type: 'ghl_webhook_failed',
        phone: phoneNumber,
        code_verified: false,
        metadata: { 
          error: errorText,
          status: ghlResponse.status,
          response_time_ms: ghlEndTime - ghlStartTime
        }
      });
      
      throw new Error(`GHL webhook failed: ${errorText}`);
    }
    
    const responseBody = await ghlResponse.text();
    console.log('[GHL SMS] Success response:', responseBody);
    console.log('[GHL SMS] Code sent successfully');

    // Log successful code send
    await supabase.from('two_fa_audit_log').insert({
      user_id: user.id,
      event_type: 'code_sent',
      phone: phoneNumber,
      metadata: { purpose }
    });

    console.log(`SMS code sent to ${phoneNumber} for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Verification code sent successfully',
        expiresIn: 300, // 5 minutes in seconds
        attemptsRemaining: 2 - (recentCodes?.length || 0)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-ghl-sms:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});