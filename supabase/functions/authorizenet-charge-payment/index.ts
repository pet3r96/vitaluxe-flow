import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Charging payment for order ${order_id}, amount: $${amount}`);

    // Fetch payment method
    const { data: paymentMethod, error: pmError } = await supabase
      .from('practice_payment_methods')
      .select('*')
      .eq('id', payment_method_id)
      .eq('practice_id', user.id)
      .single();

    if (pmError || !paymentMethod) {
      console.error('Payment method not found:', pmError);
      return new Response(
        JSON.stringify({ success: false, error: 'Payment method not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Replace with actual Authorize.Net API call when keys are available
    // Simulate payment processing (90% success, 10% failure for testing)
    const isSuccess = Math.random() > 0.1;
    
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
          JSON.stringify({ success: false, error: 'Failed to update order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      
      return new Response(
        JSON.stringify({
          success: false,
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
      JSON.stringify({ success: false, error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
