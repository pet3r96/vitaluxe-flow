import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { reason, feedback } = await req.json();

    // Get current subscription
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('practice_subscriptions')
      .select('*')
      .eq('practice_id', user.id)
      .single();

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (subscription.status === 'cancelled') {
      return new Response(
        JSON.stringify({ error: 'Subscription is already cancelled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update subscription status
    const { error: updateError } = await supabaseAdmin
      .from('practice_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log cancellation
    await supabaseAdmin.from('subscription_cancellations').insert({
      practice_id: user.id,
      subscription_id: subscription.id,
      cancelled_by: user.id,
      reason: reason || null,
      feedback: feedback || null,
    });

    // Create audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action_type: 'subscription_cancelled',
      entity_type: 'subscription',
      entity_id: subscription.id,
      details: { reason, feedback },
    });

    // Get user email for notification
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    console.log(`Subscription cancelled for user ${user.id} (${profile?.email})`);

    return successResponse({ 
      message: 'Subscription cancelled successfully',
      cancelled_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in cancel-subscription:', error);
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
});