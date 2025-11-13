import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
}

interface RefundRequest {
  order_id: string;
  refund_amount?: number;
  refund_reason?: string;
  is_automatic?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, refund_amount, refund_reason, is_automatic }: RefundRequest = await req.json();
    
    const supabase = createAuthClient(req.headers.get('Authorization'));

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

    console.log(`Processing refund for order ${order_id}, automatic: ${is_automatic}`);

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validation checks
    if (!order.authorizenet_transaction_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'No payment transaction found for this order' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.payment_status === 'refunded') {
      return new Response(
        JSON.stringify({ success: false, error: 'Order already fully refunded' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate refund details
    const remainingRefundable = order.total_amount - (order.total_refunded_amount || 0);
    const actualRefundAmount = refund_amount || remainingRefundable;
    const refundType = actualRefundAmount >= remainingRefundable ? 'full' : 'partial';

    if (actualRefundAmount > remainingRefundable) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Can only refund up to $${remainingRefundable.toFixed(2)}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing approved full refunds
    const { data: existingRefunds } = await supabase
      .from('order_refunds')
      .select('*')
      .eq('original_transaction_id', order.authorizenet_transaction_id)
      .eq('refund_status', 'approved')
      .eq('refund_type', 'full');

    if (existingRefunds && existingRefunds.length > 0 && refundType === 'full') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'A full refund has already been processed for this transaction' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Replace with actual Authorize.Net refund API call when keys are available
    // Simulate refund processing
    const mockRefundTransactionId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mockRefundResponse = {
      messages: {
        resultCode: 'Ok',
        message: [{ code: 'I00001', text: 'Successful.' }]
      },
      transactionResponse: {
        transId: mockRefundTransactionId,
        responseCode: '1',
        authCode: 'REFUND',
      }
    };

    // Insert refund record
    const { data: refund, error: refundError } = await supabase
      .from('order_refunds')
      .insert({
        order_id: order_id,
        refund_transaction_id: mockRefundTransactionId,
        original_transaction_id: order.authorizenet_transaction_id,
        refund_amount: actualRefundAmount,
        refund_reason: refund_reason || (is_automatic ? 'Automatic refund on order cancellation' : 'Manual refund'),
        refund_type: refundType,
        refunded_by: user.id,
        refund_status: 'approved',
        authorizenet_response: mockRefundResponse,
      })
      .select()
      .single();

    if (refundError) {
      console.error('Error creating refund record:', refundError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create refund record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Refund processed successfully: ${refund.id}, type: ${refundType}`);

    return new Response(
      JSON.stringify({
        success: true,
        refund: refund,
        message: `${refundType === 'full' ? 'Full' : 'Partial'} refund of $${actualRefundAmount.toFixed(2)} processed successfully`,
        authorizenet_response: mockRefundResponse
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
