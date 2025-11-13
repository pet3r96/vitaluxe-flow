import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAuthClient(req.headers.get('Authorization'));
    const supabaseAdmin = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabase, user.id, csrfToken);
    if (!valid) {
      console.error('CSRF validation failed:', csrfError);
      return new Response(
        JSON.stringify({ error: csrfError || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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