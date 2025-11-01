import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0'
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

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

  try {
    const { order_id, payment_method_id, amount }: ChargeRequest = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Create admin client for operations requiring elevated permissions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

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

    console.log(`Charging payment for order ${order_id}, amount: $${amount}`);

    // Fetch the order to get the doctor_id (practice owner)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, doctor_id')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order not found. Please try again or contact support.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Order ${order_id} placed by practice ${order.doctor_id}`);
    console.log(`Verifying payment method ${payment_method_id}...`);

    // Fetch payment method (no practice_id filter initially)
    const { data: paymentMethod, error: pmError } = await supabase
      .from('practice_payment_methods')
      .select('*')
      .eq('id', payment_method_id)
      .single();

    if (pmError || !paymentMethod) {
      console.error('Payment method not found:', pmError);
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
    console.log('Authorization check starting:', { currentUserId, order_doctor_id: order.doctor_id, payment_method_practice_id: paymentMethod.practice_id });

    // Verify ownership: payment method must belong to the practice or the user must be authorized
    let isAuthorized = false;

    // Case 1: Payment method belongs to the practice that owns the order
    if (paymentMethod.practice_id === order.doctor_id) {
      console.log('✓ Payment authorized: practice card');
      isAuthorized = true;
    } else if (currentUserId === order.doctor_id) {
      // Case 2: Current user is the practice owner
      console.log('✓ Payment authorized: practice owner');
      isAuthorized = true;
    } else {
      console.log('Checking staff/provider membership for user on practice...');
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

      console.log('Membership checks:', { hasProviderLink: !!providerLink, hasStaffMembership: !!staffMembership });

      if (providerLink || staffMembership) {
        // User is linked to this practice: allow practice card or personal card
        if (paymentMethod.practice_id === order.doctor_id || paymentMethod.practice_id === currentUserId) {
          console.log('✓ Payment authorized: linked user using practice or personal card');
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      console.error('Payment authorization failed', {
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
      console.log('Test card detected (0000) - forcing success');
    } else if (lastFour === '1111') {
      // Test card - guaranteed failure
      isSuccess = false;
      console.log('Test card detected (1111) - forcing failure');
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
        console.error('Error updating order:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Unable to process payment. Please try again or contact support.' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Payment successful: ${mockTransactionId}`);

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
      console.log(`Payment failed for order ${order_id}`);
      
      // Mark payment method as declined
      const { error: updateError } = await supabaseAdmin
        .from('practice_payment_methods')
        .update({ status: 'declined' })
        .eq('id', payment_method_id);
        
      if (updateError) {
        console.error('Failed to mark payment method as declined:', updateError);
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
    console.error('Unexpected error:', error);
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
