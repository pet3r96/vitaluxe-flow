import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[patient-practice-context] Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!token || token.length < 10) {
      console.error('[patient-practice-context] Invalid Authorization token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[patient-practice-context] Missing Supabase envs');
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('[patient-practice-context] Auth failed:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log('[patient-practice-context] Auth OK, userId:', userId);

    // Get patient account
    const { data: patientAccount, error: patientError } = await supabase
      .from('patient_accounts')
      .select('id, practice_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (patientError) {
      console.error('[patient-practice-context] Patient account query error:', patientError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch patient account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!patientAccount) {
      console.log('[patient-practice-context] No patient account found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          practice: null, 
          isSubscribed: false,
          reason: 'no_patient_account' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!patientAccount.practice_id) {
      console.log('[patient-practice-context] No practice assigned');
      return new Response(
        JSON.stringify({ 
          success: true, 
          practice: null, 
          isSubscribed: false,
          reason: 'no_practice_assigned' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch practice details
    const { data: practice, error: practiceError } = await supabase
      .from('profiles')
      .select('name, address_city, address_state')
      .eq('id', patientAccount.practice_id)
      .single();

    if (practiceError || !practice) {
      console.error('[patient-practice-context] Practice query error:', practiceError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          practice: null, 
          isSubscribed: false,
          reason: 'practice_not_found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch subscription
    const { data: subscription, error: subError } = await supabase
      .from('practice_subscriptions')
      .select('status, trial_ends_at, current_period_end, grace_period_ends_at')
      .eq('practice_id', patientAccount.practice_id)
      .maybeSingle();

    let isSubscribed = false;
    let subscriptionStatus = 'none';

    if (subscription && !subError) {
      const now = new Date();
      subscriptionStatus = subscription.status;

      if (subscription.status === 'trial' && subscription.trial_ends_at) {
        isSubscribed = new Date(subscription.trial_ends_at) > now;
      } else if (subscription.status === 'active' && subscription.current_period_end) {
        isSubscribed = new Date(subscription.current_period_end) > now;
      } else if (subscription.status === 'suspended' && subscription.grace_period_ends_at) {
        isSubscribed = new Date(subscription.grace_period_ends_at) > now;
      }
    }

    console.log('[patient-practice-context] Result:', {
      patientAccountId: patientAccount.id,
      practiceId: patientAccount.practice_id,
      practiceName: practice.name,
      subscriptionStatus,
      isSubscribed
    });

    return new Response(
      JSON.stringify({
        success: true,
        practice: {
          id: patientAccount.practice_id,
          name: practice.name,
          city: practice.address_city,
          state: practice.address_state
        },
        isSubscribed,
        status: subscriptionStatus
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[patient-practice-context] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
