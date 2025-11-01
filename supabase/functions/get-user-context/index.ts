import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

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
      twoFAResult
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

    const practiceId = providerResult.status === 'fulfilled' 
      ? providerResult.value.data?.practice_id 
      : null;

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

    // Return complete user context
    return new Response(
      JSON.stringify({
        userId,
        role,
        practiceId,
        canImpersonate,
        passwordStatus,
        twoFAStatus,
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
