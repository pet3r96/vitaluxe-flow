import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    console.log('[get-patient-practice] Invoked');
    
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    
    if (!token) {
      console.error('[get-patient-practice] Missing authorization token');
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create service role client for auth and impersonation queries
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user authentication
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('[get-patient-practice] Authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[get-patient-practice] User authenticated:', user.id);

    // Check for active impersonation session using service role
    console.log('[get-patient-practice] Checking impersonation for admin:', user.id);
    const { data: impersonationSession, error: impersonationError } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role')
      .eq('admin_user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    
    console.log('[get-patient-practice] Impersonation query result:', { 
      found: !!impersonationSession, 
      role: impersonationSession?.impersonated_role,
      impersonated_id: impersonationSession?.impersonated_user_id,
      error: impersonationError
    });

    if (impersonationError) {
      console.error('[get-patient-practice] Impersonation check error:', impersonationError);
    }

    // Use impersonated user ID if impersonating as patient, otherwise use actual user ID
    const effectiveUserId = (impersonationSession?.impersonated_role === 'patient') 
      ? impersonationSession.impersonated_user_id 
      : user.id;

    console.log('[get-patient-practice] Effective user ID:', effectiveUserId, 'Impersonating:', !!impersonationSession);

    // Get patient account and practice info using service role to bypass RLS during impersonation
    const { data: patientAccount, error: patientError } = await supabaseAdmin
      .from('patient_accounts')
      .select('id, practice_id, profiles!patient_accounts_practice_id_fkey(name, address_city, address_state)')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    console.log('[get-patient-practice] Patient account lookup:', { patientAccount, error: patientError });

    if (patientError) {
      console.error('[get-patient-practice] Database error:', patientError);
      return new Response(JSON.stringify({ error: 'Failed to fetch patient data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!patientAccount) {
      console.error('[get-patient-practice] Patient account not found');
      return new Response(JSON.stringify({ error: 'Patient account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const practice = Array.isArray(patientAccount.profiles) ? patientAccount.profiles[0] : patientAccount.profiles;
    
    const response = {
      patientAccountId: patientAccount.id,
      practiceId: patientAccount.practice_id,
      practice: patientAccount.practice_id ? {
        name: practice?.name || null,
        city: practice?.address_city || null,
        state: practice?.address_state || null,
      } : null
    };

    console.log('[get-patient-practice] Successfully fetched data:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[get-patient-practice] Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
