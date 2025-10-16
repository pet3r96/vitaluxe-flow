import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-anet-signature',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const signature = req.headers.get('x-anet-signature');

    console.log('Authorize.Net webhook received:', payload.eventType);

    // TODO: Validate webhook signature when keys are available
    // const isValid = validateWebhookSignature(signature, payload);
    // if (!isValid) {
    //   return new Response(JSON.stringify({ error: 'Invalid signature' }), { 
    //     status: 401, 
    //     headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    //   });
    // }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const eventType = payload.eventType;
    const transactionId = payload.payload?.id;

    switch (eventType) {
      case 'net.authorize.payment.authcapture.created':
        console.log(`Payment captured: ${transactionId}`);
        // Update order payment status if needed
        if (transactionId) {
          await supabase
            .from('orders')
            .update({ payment_status: 'paid' })
            .eq('authorizenet_transaction_id', transactionId);
        }
        break;

      case 'net.authorize.payment.refund.created':
        console.log(`Refund created: ${transactionId}`);
        // The refund trigger should handle status updates
        break;

      case 'net.authorize.payment.void.created':
        console.log(`Payment voided: ${transactionId}`);
        if (transactionId) {
          await supabase
            .from('orders')
            .update({ payment_status: 'voided' })
            .eq('authorizenet_transaction_id', transactionId);
        }
        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    // Log webhook event
    await supabase.from('audit_logs').insert({
      action_type: 'authorizenet_webhook',
      entity_type: 'payment',
      entity_id: transactionId,
      details: {
        event_type: eventType,
        payload: payload,
        signature: signature,
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
