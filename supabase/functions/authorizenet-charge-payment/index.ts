import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateRequestSize } from '../_shared/requestSizeValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
}

interface ChargeRequest {
  order_id: string;
  payment_method_id: string;
  amount: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ipAddress = getClientIP(req);

  try {
    // PHASE 3: Request size validation
    const sizeValidation = validateRequestSize(req, 'authorizenet-charge-payment', corsHeaders);
    if (sizeValidation) return sizeValidation;

    const { order_id, payment_method_id, amount }: ChargeRequest = await req.json();
    
    const supabase = createAuthClient(req.headers.get('Authorization'));
    const supabaseAdmin = createAdminClient();

    // PHASE 3: Rate limiting (5 charges per hour per user)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      user.id,
      'authorizenet-charge-payment',
      { maxRequests: 5, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { userId: user.id, function: 'authorizenet-charge-payment' });
      return new Response(
        JSON.stringify({ error: 'Too many payment attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    edgeLogger.info("Charging payment for order", { order_id, amount });

    // Fetch the order to get the doctor_id (practice owner)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, doctor_id')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      edgeLogger.error('Order not found', orderError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order not found. Please try again or contact support.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info("Order found", { order_id, practice_id: order.doctor_id });
    edgeLogger.info("Verifying payment method", { payment_method_id });

    // Fetch payment method (no practice_id filter initially)
    const { data: paymentMethod, error: pmError } = await supabase
      .from('practice_payment_methods')
      .select('*')
      .eq('id', payment_method_id)
      .single();

    if (pmError || !paymentMethod) {
      edgeLogger.error('Payment method not found', pmError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Payment method not found. Please select a valid payment method or add a new one.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the current user placing the order
    const currentUserId = user.id;
    edgeLogger.info('Authorization check starting', { currentUserId, order_doctor_id: order.doctor_id, payment_method_practice_id: paymentMethod.practice_id });

    // Verify ownership: payment method must belong to the practice or the user must be authorized
    let isAuthorized = false;

    // Case 1: Payment method belongs to the practice that owns the order
    if (paymentMethod.practice_id === order.doctor_id) {
      edgeLogger.info('Payment authorized: practice card');
      isAuthorized = true;
    } else if (currentUserId === order.doctor_id) {
      // Case 2: Current user is the practice owner
      edgeLogger.info('Payment authorized: practice owner');
      isAuthorized = true;
    } else {
      edgeLogger.info('Checking staff/provider membership for user on practice');
      // Check if user is a provider for this practice
      const { data: providerLink } = await supabaseAdmin
        .from('providers')
        .select('practice_id, user_id, active')
        .eq('user_id', currentUserId)
        .eq('practice_id', order.doctor_id)
        .eq('active', true)
        .maybeSingle();

      // Check if user is a staff member for this practice
      const { data: staffMembership } = await supabaseAdmin
        .from('practice_staff')
        .select('practice_id, user_id, active')
        .eq('user_id', currentUserId)
        .eq('practice_id', order.doctor_id)
        .eq('active', true)
        .maybeSingle();

      edgeLogger.info('Membership checks', { hasProviderLink: !!providerLink, hasStaffMembership: !!staffMembership });

      if (providerLink || staffMembership) {
        // User is linked to this practice: allow practice card or personal card
        if (paymentMethod.practice_id === order.doctor_id || paymentMethod.practice_id === currentUserId) {
          edgeLogger.info('Payment authorized: linked user using practice or personal card');
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      edgeLogger.error('Payment authorization failed', undefined, {
        payment_method_practice_id: paymentMethod.practice_id,
        order_doctor_id: order.doctor_id,
        current_user_id: currentUserId
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'You can only use payment methods associated with your practice. Please select a different payment method.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Replace with actual Authorize.Net API call when keys are available
    // Test card support for reliable testing:
    // - Cards ending in 0000 = always succeed
    // - Cards ending in 1111 = always fail (declined)
    // - Other cards = 90% success for realistic testing
    const lastFour = paymentMethod.card_last_five?.slice(-4) || '';
    let isSuccess;

    if (lastFour === '0000') {
      // Test card - guaranteed success
      isSuccess = true;
      edgeLogger.info('Test card detected (0000) - forcing success');
    } else if (lastFour === '1111') {
      // Test card - guaranteed failure
      isSuccess = false;
      edgeLogger.info('Test card detected (1111) - forcing failure');
    } else {
      // Real cards - simulate 90% success rate
      isSuccess = Math.random() > 0.1;
    }
    
    if (isSuccess) {
      const mockTransactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Update order with transaction details
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          authorizenet_transaction_id: mockTransactionId,
          authorizenet_profile_id: paymentMethod.authorizenet_profile_id,
          payment_method_used: paymentMethod.payment_type,
          payment_method_id: payment_method_id,
          payment_status: 'paid',
        })
        .eq('id', order_id);

      if (updateError) {
        edgeLogger.error('Error updating order', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Unable to process payment. Please try again or contact support.' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      edgeLogger.info("Payment successful", { transaction_id: mockTransactionId });

      return new Response(
        JSON.stringify({
          success: true,
          transaction_id: mockTransactionId,
          message: 'Payment processed successfully',
          authorizenet_response: {
            messages: {
              resultCode: 'Ok',
              message: [{ code: 'I00001', text: 'Successful.' }]
            }
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Simulate payment failure
      edgeLogger.info("Payment failed for order", { order_id });
      
      // Mark payment method as declined
      const { error: updateError } = await supabaseAdmin
        .from('practice_payment_methods')
        .update({ status: 'declined' })
        .eq('id', payment_method_id);
        
      if (updateError) {
        edgeLogger.error('Failed to mark payment method as declined', updateError);
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Your card was declined. Please try a different payment method or contact your bank.',
          message: 'Payment declined',
          authorizenet_response: {
            messages: {
              resultCode: 'Error',
              message: [{ code: 'E00027', text: 'The transaction was declined.' }]
            }
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    edgeLogger.error('Unexpected error in authorizenet-charge-payment', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Payment processing error. Please try again or use a different payment method.',
        details: error instanceof Error ? error.message : String(error) 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
