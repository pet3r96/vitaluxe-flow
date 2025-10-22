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

    // Verify admin role
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = userRoles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    const { testPhone } = await req.json();

    if (!testPhone) {
      throw new Error('testPhone is required');
    }

    // Send test code via GHL
    const testCode = '123456';
    console.log('[GHL Test] Sending test code to:', testPhone);
    console.log('[GHL Test] Webhook URL:', ghlWebhookUrl);

    const startTime = Date.now();
    const ghlResponse = await fetch(ghlWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone: testPhone, code: testCode })
    });
    const endTime = Date.now();

    const responseText = await ghlResponse.text();

    const diagnostics = {
      success: ghlResponse.ok,
      status: ghlResponse.status,
      statusText: ghlResponse.statusText,
      responseTime: endTime - startTime,
      webhookUrl: ghlWebhookUrl,
      responseBody: responseText,
      headers: Object.fromEntries(ghlResponse.headers.entries()),
      timestamp: new Date().toISOString()
    };

    console.log('[GHL Test] Diagnostics:', JSON.stringify(diagnostics, null, 2));

    return new Response(
      JSON.stringify(diagnostics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[GHL Test] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
