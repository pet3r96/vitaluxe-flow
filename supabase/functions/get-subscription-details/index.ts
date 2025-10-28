import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get subscription details
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('practice_subscriptions')
      .select('*')
      .eq('practice_id', user.id)
      .single();

    if (subError) {
      console.error('Error fetching subscription:', subError);
    }

    // Get payment methods
    const { data: paymentMethods, error: pmError } = await supabaseAdmin
      .from('practice_payment_methods')
      .select('*')
      .eq('practice_id', user.id)
      .order('is_default', { ascending: false });

    if (pmError) {
      console.error('Error fetching payment methods:', pmError);
    }

    // Get invoices
    const { data: invoices, error: invError } = await supabaseAdmin
      .from('subscription_invoices')
      .select('*')
      .eq('practice_id', user.id)
      .order('invoice_date', { ascending: false })
      .limit(12);

    if (invError) {
      console.error('Error fetching invoices:', invError);
    }

    return new Response(
      JSON.stringify({
        subscription: subscription || null,
        paymentMethods: paymentMethods || [],
        invoices: invoices || [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-subscription-details:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});