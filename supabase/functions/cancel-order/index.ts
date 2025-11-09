import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0'
import { validateCancelOrderRequest } from "../_shared/requestValidators.ts";
import { validateCSRFToken } from "../_shared/csrfValidator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CancelOrderRequest {
  orderId: string;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse JSON with error handling
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      console.error('Invalid JSON in request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = validateCancelOrderRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data', 
          details: validation.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CSRF token
    const { csrf_token, orderId, reason } = requestData as CancelOrderRequest & { csrf_token?: string };
    const csrfValidation = await validateCSRFToken(supabase, user.id, csrf_token);
    if (!csrfValidation.valid) {
      console.warn(`CSRF validation failed for user ${user.email}:`, csrfValidation.error);
      return new Response(
        JSON.stringify({ error: 'Security validation failed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Cancel request from ${user.id} for order ${orderId}`);

    // Check if user can cancel this order
    const { data: canCancel, error: checkError } = await supabase
      .rpc('can_cancel_order', { 
        _order_id: orderId,
        _user_id: user.id 
      });

    if (checkError) {
      console.error('Error checking cancellation eligibility:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify cancellation eligibility' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!canCancel) {
      console.log(`User ${user.id} not authorized to cancel order ${orderId}`);
      return new Response(
        JSON.stringify({ error: 'You are not authorized to cancel this order or the cancellation window has expired' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform cancellation
    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: reason || 'No reason provided'
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      console.error('Error cancelling order:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to cancel order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Order ${orderId} successfully cancelled by ${user.id}`);

    // Trigger automatic refund if order was paid
    if (order && order.authorizenet_transaction_id && order.payment_status === 'paid') {
      console.log(`Triggering automatic refund for cancelled order ${orderId}`);
      
      try {
        const refundResponse = await supabase.functions.invoke('authorizenet-refund-transaction', {
          body: {
            order_id: orderId,
            refund_reason: `Order cancelled by user: ${reason || 'No reason provided'}`,
            is_automatic: true
          }
        });
        
        if (refundResponse.error) {
          console.error('Automatic refund failed:', refundResponse.error);
        } else {
          console.log(`Automatic refund initiated: ${refundResponse.data?.refund?.id}`);
        }
      } catch (error) {
        console.error('Automatic refund exception:', error);
      }
    }

    // Send cancellation notification to pharmacy if API enabled
    try {
      const { data: orderLines } = await supabase
        .from('order_lines')
        .select('assigned_pharmacy_id')
        .eq('order_id', orderId)
        .limit(1)
        .single();

      if (orderLines?.assigned_pharmacy_id) {
        console.log(`Sending cancellation to pharmacy ${orderLines.assigned_pharmacy_id}`);
        await supabase.functions.invoke('send-cancellation-to-pharmacy', {
          body: {
            order_id: orderId,
            pharmacy_id: orderLines.assigned_pharmacy_id,
            cancellation_reason: reason || 'Customer cancelled order',
          }
        });
      }
    } catch (error) {
      console.error('Failed to send pharmacy cancellation:', error);
      // Non-fatal, continue with cancellation
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        order,
        message: 'Order cancelled successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
