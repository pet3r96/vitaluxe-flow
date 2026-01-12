import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { edgeLogger } from '../_shared/logger.ts';

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
      edgeLogger.error('CSRF validation failed', new Error(csrfError || 'Invalid CSRF token'));
      return new Response(
        JSON.stringify({ error: csrfError || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('Processing refund', { orderId: order_id, isAutomatic: is_automatic });

    // Fetch order with payment method details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, practice_payment_methods(*)')
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

    // PRODUCTION: Call Authorize.Net refund API
    const apiLoginId = Deno.env.get('AUTHORIZENET_API_LOGIN_ID');
    const transactionKey = Deno.env.get('AUTHORIZENET_TRANSACTION_KEY');

    if (!apiLoginId || !transactionKey) {
      edgeLogger.error('Missing Authorize.Net credentials for refund');
      return new Response(
        JSON.stringify({ success: false, error: 'Refund processing unavailable. Please try again later.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get payment method details for the refund
    const paymentMethod = order.practice_payment_methods;
    const cardLastFour = paymentMethod?.card_last_five?.slice(-4) || '0000';

    edgeLogger.info('Calling Authorize.Net refund API', {
      transactionId: order.authorizenet_transaction_id,
      refundAmount: actualRefundAmount,
      refundType
    });

    // Build refund request
    const refundRequest = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: apiLoginId,
          transactionKey: transactionKey
        },
        transactionRequest: {
          transactionType: 'refundTransaction',
          amount: actualRefundAmount.toFixed(2),
          refTransId: order.authorizenet_transaction_id,
          payment: {
            creditCard: {
              cardNumber: cardLastFour,
              expirationDate: 'XXXX' // Required but not validated for refunds
            }
          }
        }
      }
    };

    const authnetResponse = await fetch('https://api.authorize.net/xml/v1/request.api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(refundRequest)
    });

    const authnetResult = await authnetResponse.json();

    edgeLogger.info('Authorize.Net refund response', {
      resultCode: authnetResult?.messages?.resultCode,
      responseCode: authnetResult?.transactionResponse?.responseCode
    });

    const transactionResponse = authnetResult?.transactionResponse;
    const isSuccess = authnetResult?.messages?.resultCode === 'Ok' && 
                      transactionResponse?.responseCode === '1';

    if (!isSuccess) {
      const errorMessage = transactionResponse?.errors?.[0]?.errorText || 
                           authnetResult?.messages?.message?.[0]?.text ||
                           'Refund failed';
      
      edgeLogger.error('Refund failed', { errorMessage, response: authnetResult });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Refund failed: ${errorMessage}`,
          authorizenet_response: authnetResult
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const refundTransactionId = transactionResponse.transId;

    // Insert refund record
    const { data: refund, error: refundError } = await supabase
      .from('order_refunds')
      .insert({
        order_id: order_id,
        refund_transaction_id: refundTransactionId,
        original_transaction_id: order.authorizenet_transaction_id,
        refund_amount: actualRefundAmount,
        refund_reason: refund_reason || (is_automatic ? 'Automatic refund on order cancellation' : 'Manual refund'),
        refund_type: refundType,
        refunded_by: user.id,
        refund_status: 'approved',
        authorizenet_response: authnetResult,
      })
      .select()
      .single();

    if (refundError) {
      edgeLogger.error('Error creating refund record', refundError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: 'Refund processed but record creation failed',
          transaction_id: refundTransactionId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update order's total refunded amount and status
    const newTotalRefunded = (order.total_refunded_amount || 0) + actualRefundAmount;
    const newPaymentStatus = refundType === 'full' ? 'refunded' : 'partially_refunded';

    await supabaseAdmin
      .from('orders')
      .update({
        total_refunded_amount: newTotalRefunded,
        payment_status: newPaymentStatus
      })
      .eq('id', order_id);

    edgeLogger.info('Refund processed successfully', { 
      refundId: refund.id, 
      refundType,
      transactionId: refundTransactionId
    });

    return new Response(
      JSON.stringify({
        success: true,
        refund: refund,
        message: `${refundType === 'full' ? 'Full' : 'Partial'} refund of $${actualRefundAmount.toFixed(2)} processed successfully`,
        transaction_id: refundTransactionId,
        authorizenet_response: authnetResult
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    edgeLogger.error('Unexpected error', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
