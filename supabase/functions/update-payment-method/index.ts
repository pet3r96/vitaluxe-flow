import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

/**
 * Resolve the practice ID for the authenticated user.
 * Practice owners: user.id === practice_id
 * Staff/providers: look up via providers or practice_staff tables
 */
async function resolvePracticeId(supabaseAdmin: any, userId: string): Promise<string | null> {
  // First check if user IS a practice (practice owner)
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (profile?.role === 'practice') {
    return userId;
  }

  // Check providers table
  const { data: provider } = await supabaseAdmin
    .from('providers')
    .select('practice_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1);

  if (provider && provider.length > 0) {
    return provider[0].practice_id;
  }

  // Check practice_staff table
  const { data: staff } = await supabaseAdmin
    .from('practice_staff')
    .select('practice_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1);

  if (staff && staff.length > 0) {
    return staff[0].practice_id;
  }

  return null;
}

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
      edgeLogger.error('CSRF validation failed', undefined, { error: csrfError });
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

    // Resolve user's practice ID (works for owners, staff, and providers)
    const practiceId = await resolvePracticeId(supabaseAdmin, user.id);
    if (!practiceId) {
      return new Response(
        JSON.stringify({ error: 'No associated practice found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify payment method belongs to the user's practice
    const { data: paymentMethod, error: pmError } = await supabaseAdmin
      .from('practice_payment_methods')
      .select('*')
      .eq('id', payment_method_id)
      .eq('practice_id', practiceId)
      .single();

    if (pmError || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: 'Payment method not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (is_default) {
      // Unset all other payment methods as default for this practice
      await supabaseAdmin
        .from('practice_payment_methods')
        .update({ is_default: false })
        .eq('practice_id', practiceId);

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
        details: { set_as_default: true, practice_id: practiceId },
      });
    }

    edgeLogger.info('Payment method updated', {
      hasPaymentMethod: !!payment_method_id,
      hasUserId: !!user.id,
      practiceId,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Payment method updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    edgeLogger.error('Error in update-payment-method', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
