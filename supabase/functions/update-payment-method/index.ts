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

    const { payment_method_id, is_default } = await req.json();

    if (!payment_method_id) {
      return new Response(
        JSON.stringify({ error: 'payment_method_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify payment method belongs to user
    const { data: paymentMethod, error: pmError } = await supabaseAdmin
      .from('practice_payment_methods')
      .select('*')
      .eq('id', payment_method_id)
      .eq('practice_id', user.id)
      .single();

    if (pmError || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: 'Payment method not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (is_default) {
      // Unset all other payment methods as default
      await supabaseAdmin
        .from('practice_payment_methods')
        .update({ is_default: false })
        .eq('practice_id', user.id);

      // Set this payment method as default
      const { error: updateError } = await supabaseAdmin
        .from('practice_payment_methods')
        .update({ is_default: true })
        .eq('id', payment_method_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create audit log
      await supabaseAdmin.from('audit_logs').insert({
        user_id: user.id,
        action_type: 'payment_method_updated',
        entity_type: 'payment_method',
        entity_id: payment_method_id,
        details: { set_as_default: true },
      });
    }

    console.log(`Payment method ${payment_method_id} updated for user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Payment method updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-payment-method:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});