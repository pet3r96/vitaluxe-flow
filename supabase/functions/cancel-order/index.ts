import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { validateCancelOrderRequest } from "../_shared/requestValidators.ts";
import { validateCSRFToken } from "../_shared/csrfValidator.ts";
import { edgeLogger } from '../_shared/logger.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';
import { validateInput, cancelOrderSchema } from '../_shared/zodSchemas.ts';

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

  const startTime = Date.now();
  const ipAddress = getClientIP(req);

  try {
    const supabase = createAuthClient(req.headers.get('Authorization'));

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      edgeLogger.error('Cancel order authentication error', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 3: Rate limiting (20 requests/hour)
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabase,
      ipAddress,
      'cancel-order',
      { maxRequests: 20, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { function: 'cancel-order', ipAddress });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate input
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      edgeLogger.error('Invalid JSON in cancel order request', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 3: Schema validation
    const validation = validateInput(cancelOrderSchema, requestData);
    if (!validation.success) {
      edgeLogger.warn('Validation failed', { errors: validation.errors });
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { orderId, reason, csrf_token } = validation.data;

    // PHASE 3: ID validation (tenant isolation)
    const { valid: ownsResource, error: idError } = await validateUserOwnsResource(
      supabase,
      user.id,
      'order',
      orderId
    );

    if (!ownsResource) {
      edgeLogger.error('ID validation failed', undefined, { error: idError, userId: user.id, orderId });
      return new Response(
        JSON.stringify({ error: idError || 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CSRF token
    const csrfValidation = await validateCSRFToken(supabase, user.id, csrf_token);
    if (!csrfValidation.valid) {
      edgeLogger.warn('CSRF validation failed for cancel order', { error: csrfValidation.error });
      return new Response(
        JSON.stringify({ error: 'Security validation failed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('Cancel order request received', { orderId });

    // Check if user can cancel this order
    const { data: canCancel, error: checkError } = await supabase
      .rpc('can_cancel_order', { 
        _order_id: orderId,
        _user_id: user.id 
      });

    if (checkError) {
      edgeLogger.error('Error checking order cancellation eligibility', checkError, { orderId });
      return new Response(
        JSON.stringify({ error: 'Failed to verify cancellation eligibility' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!canCancel) {
      edgeLogger.warn('Order cancellation not authorized', { orderId });
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
      edgeLogger.error('Error cancelling order', updateError, { orderId });
      return new Response(
        JSON.stringify({ error: 'Failed to cancel order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('Order cancelled successfully', { orderId });

    // Trigger automatic refund if order was paid
    if (order && order.authorizenet_transaction_id && order.payment_status === 'paid') {
      edgeLogger.info('Triggering automatic refund for cancelled order', { orderId });
      
      try {
        const refundResponse = await supabase.functions.invoke('authorizenet-refund-transaction', {
          body: {
            order_id: orderId,
            refund_reason: `Order cancelled by user: ${reason || 'No reason provided'}`,
            is_automatic: true
          }
        });
        
        if (refundResponse.error) {
          edgeLogger.error('Automatic refund failed', refundResponse.error, { orderId });
        } else {
          edgeLogger.info('Automatic refund initiated', { refundId: refundResponse.data?.refund?.id, orderId });
        }
      } catch (error) {
        edgeLogger.error('Automatic refund exception', error, { orderId });
      }
    }

    // Update order lines to cancelled status
    try {
      const { data: orderLines } = await supabase
        .from('order_lines')
        .select('id, assigned_pharmacy_id, pharmacy_order_id')
        .eq('order_id', orderId);

      if (orderLines && orderLines.length > 0) {
        // Update all order lines to cancelled
        await supabase
          .from('order_lines')
          .update({ status: 'cancelled' })
          .eq('order_id', orderId);
        
        edgeLogger.info('Order lines updated to cancelled', { count: orderLines.length });
      }
    } catch (error) {
      edgeLogger.error('Failed to update order lines status', error);
      // Non-fatal, continue with cancellation
    }

    // PHASE 2: Structured logging
    edgeLogger.logOperation({
      user_id: user.id,
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      operation: 'cancel_order',
      success: true,
      duration_ms: Date.now() - startTime,
      metadata: { orderId, reason: reason || 'No reason provided' }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        order,
        message: 'Order cancelled successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    edgeLogger.error('Unexpected error in cancel-order', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
