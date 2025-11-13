import { createAuthClient } from '../_shared/supabaseAdmin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateProfileRequest {
  payment_type: 'credit_card' | 'bank_account';
  // Credit card fields (via Accept.js)
  payment_nonce?: string;
  payment_descriptor?: string;
  card_type?: string;
  card_last_five?: string;
  card_expiry?: string;
  cardholder_name?: string;
  // eCheck fields
  routing_number?: string;
  account_number?: string;
  account_type?: 'checking' | 'savings' | 'businessChecking';
  bank_name?: string;
  account_holder_name?: string;
  // Billing address
  billing_address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  is_default?: boolean;
  practice_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: CreateProfileRequest = await req.json();
    
    const supabase = createAuthClient(req.headers.get('Authorization'));

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine which practice to save to (for impersonation support)
    const targetPracticeId = requestData.practice_id || user.id;
    
    console.log(`Creating payment profile for user ${user.id}, target practice: ${targetPracticeId}, type: ${requestData.payment_type}`);

    // TODO: Replace with actual Authorize.Net API call when keys are available
    // For now, simulate successful profile creation
    const mockCustomerProfileId = `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mockPaymentProfileId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare payment method data
    const paymentMethodData: any = {
      practice_id: targetPracticeId,
      payment_type: requestData.payment_type,
      authorizenet_profile_id: mockCustomerProfileId,
      authorizenet_payment_profile_id: mockPaymentProfileId,
      billing_street: requestData.billing_address.street,
      billing_city: requestData.billing_address.city,
      billing_state: requestData.billing_address.state,
      billing_zip: requestData.billing_address.zip,
      billing_country: 'US',
      is_default: requestData.is_default || false,
    };

    if (requestData.payment_type === 'credit_card') {
      paymentMethodData.card_type = requestData.card_type;
      paymentMethodData.card_last_five = requestData.card_last_five;
      paymentMethodData.card_expiry = requestData.card_expiry;
      // Store cardholder name in bank_name field for simplicity
      paymentMethodData.bank_name = requestData.cardholder_name;
    } else {
      paymentMethodData.bank_name = requestData.bank_name;
      paymentMethodData.account_type = requestData.account_type;
      paymentMethodData.account_last_five = requestData.account_number?.slice(-5);
      paymentMethodData.routing_number_last_four = requestData.routing_number?.slice(-4);
      paymentMethodData.account_mask = requestData.account_number?.slice(-4);
    }

    // If this should be default, unset other defaults first
    if (requestData.is_default) {
      await supabase
        .from('practice_payment_methods')
        .update({ is_default: false })
        .eq('practice_id', targetPracticeId);
    }

    // Insert payment method
    const { data: paymentMethod, error: insertError } = await supabase
      .from('practice_payment_methods')
      .insert(paymentMethodData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting payment method:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save payment method', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Payment profile created successfully: ${paymentMethod.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        payment_method: paymentMethod,
        message: 'Payment method added successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
