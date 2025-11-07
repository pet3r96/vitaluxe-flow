import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Unified 2FA SMS Router
 * Routes to Twilio or GHL based on system_settings.sms_provider
 * This allows instant switching without code changes
 */
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

    // Get SMS provider setting
    const { data: providerSetting, error: settingError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'sms_provider')
      .single();

    if (settingError) {
      console.error('[2FA Router] Failed to fetch SMS provider setting:', settingError);
      // Default to Twilio if setting not found
    }

    const provider = providerSetting?.setting_value?.replace(/"/g, '') || 'twilio';
    console.log('[2FA Router] Routing to provider:', provider);

    // Parse request body to forward
    const body = await req.json();

    // Route to appropriate provider function
    if (provider === 'twilio') {
      console.log('[2FA Router] Invoking Twilio SMS function');
      const { data, error } = await supabase.functions.invoke('send-twilio-sms', {
        body,
        headers: {
          Authorization: req.headers.get('Authorization') || '',
        }
      });

      if (error) throw error;
      
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (provider === 'ghl') {
      console.log('[2FA Router] Invoking GHL SMS function');
      const { data, error } = await supabase.functions.invoke('send-ghl-sms', {
        body,
        headers: {
          Authorization: req.headers.get('Authorization') || '',
        }
      });

      if (error) throw error;
      
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('[2FA Router] Unknown provider:', provider);
      return new Response(
        JSON.stringify({ error: 'Invalid SMS provider configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('Error in send-2fa-sms router:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
