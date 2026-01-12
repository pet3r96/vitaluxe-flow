import { createAuthClient } from "../_shared/supabaseAdmin.ts";
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AUTHORIZENET_API_URL = 'https://api.authorize.net/xml/v1/request.api';

interface CreateProfileRequest {
  payment_type: 'credit_card' | 'bank_account';
  payment_nonce?: string;
  payment_descriptor?: string;
  card_type?: string;
  card_last_five?: string;
  card_expiry?: string;
  cardholder_name?: string;
  routing_number?: string;
  account_number?: string;
  account_type?: 'checking' | 'savings' | 'businessChecking';
  bank_name?: string;
  account_holder_name?: string;
  billing_address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  is_default?: boolean;
  practice_id?: string;
}

async function createCustomerProfile(
  apiLoginId: string,
  transactionKey: string,
  email: string,
  merchantCustomerId: string,
  opaqueData: { dataDescriptor: string; dataValue: string },
  billingAddress: CreateProfileRequest['billing_address'],
  cardholderName?: string
) {
  const [firstName, ...lastParts] = (cardholderName || 'Customer User').split(' ');
  const lastName = lastParts.join(' ') || 'User';

  const requestBody = {
    createCustomerProfileRequest: {
      merchantAuthentication: { name: apiLoginId, transactionKey },
      profile: {
        merchantCustomerId,
        email,
        paymentProfiles: {
          customerType: 'individual',
          billTo: {
            firstName,
            lastName,
            address: billingAddress.street,
            city: billingAddress.city,
            state: billingAddress.state,
            zip: billingAddress.zip,
            country: 'USA'
          },
          payment: { opaqueData }
        }
      },
      validationMode: 'liveMode'
    }
  };

  const response = await fetch(AUTHORIZENET_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  return response.json();
}

async function addPaymentProfile(
  apiLoginId: string,
  transactionKey: string,
  customerProfileId: string,
  opaqueData: { dataDescriptor: string; dataValue: string },
  billingAddress: CreateProfileRequest['billing_address'],
  cardholderName?: string
) {
  const [firstName, ...lastParts] = (cardholderName || 'Customer User').split(' ');
  const lastName = lastParts.join(' ') || 'User';

  const requestBody = {
    createCustomerPaymentProfileRequest: {
      merchantAuthentication: { name: apiLoginId, transactionKey },
      customerProfileId,
      paymentProfile: {
        customerType: 'individual',
        billTo: {
          firstName,
          lastName,
          address: billingAddress.street,
          city: billingAddress.city,
          state: billingAddress.state,
          zip: billingAddress.zip,
          country: 'USA'
        },
        payment: { opaqueData }
      },
      validationMode: 'liveMode'
    }
  };

  const response = await fetch(AUTHORIZENET_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiLoginId = Deno.env.get('AUTHORIZENET_API_LOGIN_ID');
    const transactionKey = Deno.env.get('AUTHORIZENET_TRANSACTION_KEY');

    if (!apiLoginId || !transactionKey) {
      edgeLogger.error('Missing Authorize.Net credentials');
      return new Response(
        JSON.stringify({ error: 'Payment system not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: CreateProfileRequest = await req.json();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabase = createAuthClient(authHeader);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetPracticeId = requestData.practice_id || user.id;
    edgeLogger.info('Creating payment profile', { userId: user.id, targetPractice: targetPracticeId, paymentType: requestData.payment_type });

    // Check for existing customer profile
    const { data: existingProfile } = await supabase
      .from('practice_payment_methods')
      .select('authorizenet_profile_id')
      .eq('practice_id', targetPracticeId)
      .not('authorizenet_profile_id', 'is', null)
      .limit(1)
      .maybeSingle();

    let customerProfileId: string;
    let paymentProfileId: string;

    const opaqueData = {
      dataDescriptor: requestData.payment_descriptor || 'COMMON.ACCEPT.INAPP.PAYMENT',
      dataValue: requestData.payment_nonce || ''
    };

    if (existingProfile?.authorizenet_profile_id) {
      // Add to existing customer
      const response = await addPaymentProfile(
        apiLoginId, transactionKey,
        existingProfile.authorizenet_profile_id,
        opaqueData,
        requestData.billing_address,
        requestData.cardholder_name
      );

      if (response.messages?.resultCode !== 'Ok') {
        const errorMsg = response.messages?.message?.[0]?.text || 'Failed to add card';
        edgeLogger.error('Authorize.Net error', { error: errorMsg });
        return new Response(
          JSON.stringify({ error: errorMsg }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      customerProfileId = existingProfile.authorizenet_profile_id;
      paymentProfileId = response.customerPaymentProfileIdList?.[0] || '';
    } else {
      // Create new customer profile
      const response = await createCustomerProfile(
        apiLoginId, transactionKey,
        user.email || '',
        `user_${targetPracticeId}`,
        opaqueData,
        requestData.billing_address,
        requestData.cardholder_name
      );

      if (response.messages?.resultCode !== 'Ok') {
        const errorMsg = response.messages?.message?.[0]?.text || 'Failed to create profile';
        edgeLogger.error('Authorize.Net error', { error: errorMsg });
        return new Response(
          JSON.stringify({ error: errorMsg }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      customerProfileId = response.customerProfileId || '';
      paymentProfileId = response.customerPaymentProfileIdList?.[0] || '';
    }

    // Unset other defaults if needed
    if (requestData.is_default) {
      await supabase
        .from('practice_payment_methods')
        .update({ is_default: false })
        .eq('practice_id', targetPracticeId);
    }

    // Insert payment method
    const paymentMethodData: any = {
      practice_id: targetPracticeId,
      payment_type: requestData.payment_type,
      authorizenet_profile_id: customerProfileId,
      authorizenet_payment_profile_id: paymentProfileId,
      billing_street: requestData.billing_address.street,
      billing_city: requestData.billing_address.city,
      billing_state: requestData.billing_address.state,
      billing_zip: requestData.billing_address.zip,
      billing_country: 'US',
      is_default: requestData.is_default || false,
      status: 'active',
    };

    if (requestData.payment_type === 'credit_card') {
      paymentMethodData.card_type = requestData.card_type;
      paymentMethodData.card_last_five = requestData.card_last_five;
      paymentMethodData.card_expiry = requestData.card_expiry;
      paymentMethodData.bank_name = requestData.cardholder_name;
    } else {
      paymentMethodData.bank_name = requestData.bank_name;
      paymentMethodData.account_type = requestData.account_type;
      paymentMethodData.account_last_five = requestData.account_number?.slice(-5);
      paymentMethodData.routing_number_last_four = requestData.routing_number?.slice(-4);
    }

    const { data: paymentMethod, error: insertError } = await supabase
      .from('practice_payment_methods')
      .insert(paymentMethodData)
      .select()
      .single();

    if (insertError) {
      edgeLogger.error('Error inserting payment method', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save payment method' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('Payment profile created', { paymentMethodId: paymentMethod.id });

    return new Response(
      JSON.stringify({ success: true, payment_method: paymentMethod, message: 'Payment method added successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    edgeLogger.error('Unexpected error', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
