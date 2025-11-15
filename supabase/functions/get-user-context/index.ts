import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Composite endpoint to batch user context queries
 * Returns user role, permissions, 2FA status, and impersonation data in one call
 * 
 * Reduces 5+ sequential queries to 1 network request
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createAuthClient(authHeader);

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const userId = user.id;

    // Batch all context queries in parallel
    const [
      roleResult,
      providerResult,
      impersonationResult,
      passwordResult,
      twoFAResult,
      twoFAPhoneResult
    ] = await Promise.allSettled([
      // User role
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle(),
      
      // Provider practice ID
      supabase
        .from('providers')
        .select('practice_id')
        .eq('user_id', userId)
        .maybeSingle(),
      
      // Impersonation permission
      supabase.rpc('can_user_impersonate', { _user_id: userId }),
      
      // Password status
      supabase
        .from('user_password_status')
        .select('must_change_password, terms_accepted')
        .eq('user_id', userId)
        .maybeSingle(),
      
      // 2FA status
      supabase
        .from('user_2fa')
        .select('setup_complete, verified')
        .eq('user_id', userId)
        .maybeSingle(),
      
      // 2FA phone number from settings
      supabase
        .from('user_2fa_settings')
        .select('phone_number, is_enrolled, twilio_enabled')
        .eq('user_id', userId)
        .maybeSingle()
    ]);

    // Process results
    let role = roleResult.status === 'fulfilled' && roleResult.value.data?.role
      ? roleResult.value.data.role
      : null;

    // Fallback: check if patient
    if (!role) {
      const { data: patientData } = await supabase
        .from('patient_accounts')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (patientData) {
        role = 'patient';
      }
    }

    // If role is staff, get practice_id from practice_staff table
    let staffPracticeId = null;
    if (role === 'staff') {
      const { data: staffData } = await supabase
        .from('practice_staff')
        .select('practice_id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (staffData?.practice_id) {
        staffPracticeId = staffData.practice_id;
      }
    }

    const practiceId = staffPracticeId || (providerResult.status === 'fulfilled' 
      ? providerResult.value.data?.practice_id 
      : null);

    const canImpersonate = impersonationResult.status === 'fulfilled' 
      ? impersonationResult.value.data === true 
      : false;

    const passwordStatus = passwordResult.status === 'fulfilled' && passwordResult.value.data
      ? {
          mustChangePassword: passwordResult.value.data.must_change_password || false,
          termsAccepted: passwordResult.value.data.terms_accepted || false
        }
      : {
          mustChangePassword: false,
          termsAccepted: false
        };

    const twoFAStatus = twoFAResult.status === 'fulfilled' && twoFAResult.value.data
      ? {
          setupComplete: twoFAResult.value.data.setup_complete || false,
          verified: twoFAResult.value.data.verified || false
        }
      : {
          setupComplete: false,
          verified: false
        };

    // Process 2FA phone
    let twoFAPhone = null;
    if (twoFAPhoneResult.status === 'fulfilled' && twoFAPhoneResult.value.data) {
      const phoneData = twoFAPhoneResult.value.data;
      twoFAPhone = phoneData.phone_number || null;
      // Update twoFAStatus with Twilio-specific enrollment status
      if (phoneData.is_enrolled && phoneData.twilio_enabled) {
        twoFAStatus.setupComplete = true;
      }
    }

    // Return complete user context
    return new Response(
      JSON.stringify({
        userId,
        role,
        practiceId,
        canImpersonate,
        passwordStatus,
        twoFAStatus,
        twoFAPhone,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching user context:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
