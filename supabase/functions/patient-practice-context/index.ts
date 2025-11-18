import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { edgeLogger } from '../_shared/logger.ts';

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
      edgeLogger.error('patient-practice-context Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!token || token.length < 10) {
      edgeLogger.error('patient-practice-context Invalid Authorization token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseKey) {
      edgeLogger.error('patient-practice-context Missing Supabase envs');
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
      edgeLogger.error('patient-practice-context Auth failed', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    edgeLogger.info('patient-practice-context Authenticated user', { userId });

    // Helper to send consistent responses
    const sendResponse = (body: any, status = 200) => {
      return new Response(
        JSON.stringify(body),
        { 
          status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    };

    // Use service role client for consistent access
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // 1. Get patient account to find practice_id
    edgeLogger.info('patient-practice-context Fetching patient account for user', { userId });
    const { data: patientAccount, error: patientError } = await supabaseClient
      .from('patient_accounts')
      .select('id, practice_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (patientError) {
      edgeLogger.error('patient-practice-context Error fetching patient account', patientError);
      return sendResponse({ 
        success: false, 
        isSubscribed: false,
        status: 'error',
        reason: 'patient_account_fetch_error',
        practice: null
      }, 500);
    }

    if (!patientAccount) {
      edgeLogger.info('patient-practice-context No patient account found');
      return sendResponse({ 
        success: false, 
        isSubscribed: false,
        status: 'patient_account_not_found',
        reason: 'patient_account_not_found',
        practice: null,
        message: 'No patient account exists for this user. Please contact your practice to create one.'
      }, 200);
    }

    if (!patientAccount.practice_id) {
      edgeLogger.info('patient-practice-context Patient has no practice assigned');
      return sendResponse({ 
        success: false, 
        isSubscribed: false,
        status: 'no_practice_assigned',
        reason: 'no_practice_assigned',
        practice: null,
        message: 'Your patient account is not yet linked to a practice. Please contact your practice administrator.'
      }, 200);
    }

    const practiceId = patientAccount.practice_id;
    edgeLogger.info('patient-practice-context Practice ID', { practiceId });

    // 2. Check practice subscription status FIRST (independent of practice profile read)
    edgeLogger.info('patient-practice-context Fetching subscription for practice', { practiceId });
    const { data: subscription, error: subError } = await supabaseClient
      .from('practice_subscriptions')
      .select('status, subscription_type, trial_ends_at, current_period_end, grace_period_ends_at')
      .eq('practice_id', practiceId)
      .maybeSingle();

    if (subError) {
      edgeLogger.error('patient-practice-context Error fetching subscription', subError);
      // Don't fail the whole request - continue with practice read
    }

    // 3. Compute subscription access (UTC-safe)
    let isSubscribed = false;
    let subscriptionStatus = 'no_subscription';
    const nowTimestamp = Date.now();
    
    if (subscription) {
      subscriptionStatus = subscription.status;
      edgeLogger.info('patient-practice-context Subscription row', {
        status: subscription.status,
        trial_ends_at: subscription.trial_ends_at,
        current_period_end: subscription.current_period_end,
        grace_period_ends_at: subscription.grace_period_ends_at,
        now_timestamp: nowTimestamp
      });
      
      // Check if practice has active access using UTC-safe comparison
      if (subscription.status === 'active' && subscription.current_period_end) {
        const endTime = new Date(subscription.current_period_end).getTime();
        isSubscribed = endTime > nowTimestamp;
        edgeLogger.info('patient-practice-context Active check', { endTime, nowTimestamp, isSubscribed });
      } else if (subscription.status === 'trial' && subscription.trial_ends_at) {
        const endTime = new Date(subscription.trial_ends_at).getTime();
        isSubscribed = endTime > nowTimestamp;
        edgeLogger.info('patient-practice-context Trial check', { endTime, nowTimestamp, isSubscribed });
      } else if (subscription.status === 'suspended' && subscription.grace_period_ends_at) {
        const endTime = new Date(subscription.grace_period_ends_at).getTime();
        isSubscribed = endTime > nowTimestamp;
        edgeLogger.info('patient-practice-context Grace check', { endTime, nowTimestamp, isSubscribed });
      }
    } else {
      edgeLogger.info('patient-practice-context No subscription found for practice');
    }

    edgeLogger.info('patient-practice-context Computed isSubscribed', { isSubscribed });

    // 4. Get practice profile details (OPTIONAL - don't fail if missing)
    let practice = null;
    const { data: practiceProfile, error: practiceError } = await supabaseClient
      .from('profiles')
      .select('id, name, address_city, address_state')
      .eq('id', practiceId)
      .maybeSingle();

    if (practiceError) {
      edgeLogger.error('patient-practice-context Error fetching practice profile (non-fatal)', practiceError);
      // Don't fail - use practice ID only
      practice = {
        id: practiceId,
        name: null,
        city: null,
        state: null
      };
    } else if (practiceProfile) {
      edgeLogger.info('patient-practice-context Practice profile', { practiceName: practiceProfile.name });
      practice = {
        id: practiceProfile.id,
        name: practiceProfile.name,
        city: practiceProfile.address_city,
        state: practiceProfile.address_state
      };
    } else {
      edgeLogger.warn('patient-practice-context No practice profile found (non-fatal)');
      practice = {
        id: practiceId,
        name: null,
        city: null,
        state: null
      };
    }

    edgeLogger.info('patient-practice-context Final response', {
      success: true,
      isSubscribed,
      status: subscriptionStatus,
      practice
    });

    return sendResponse({
      success: true,
      isSubscribed,
      status: subscriptionStatus,
      practice
    });

  } catch (error) {
    edgeLogger.error('patient-practice-context Unexpected error', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
