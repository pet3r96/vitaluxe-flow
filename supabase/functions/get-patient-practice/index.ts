import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { edgeLogger } from '../_shared/logger.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    edgeLogger.info('Function invoked');
    
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    
    if (!token) {
      edgeLogger.error('Missing authorization token', new Error('No auth token provided'));
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
      edgeLogger.error('Authentication failed', userError || new Error('User not found'));
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    edgeLogger.info('User authenticated', { userId: user.id });

    // Check for active impersonation session using service role
    edgeLogger.info('Checking impersonation for admin', { userId: user.id });
    const { data: impersonationSession, error: impersonationError } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role')
      .eq('admin_user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    
    edgeLogger.info('Impersonation query result', {
      found: !!impersonationSession, 
      role: impersonationSession?.impersonated_role,
      impersonated_id: impersonationSession?.impersonated_user_id,
      error: impersonationError
    });

    if (impersonationError) {
      edgeLogger.error('Impersonation check error', impersonationError);
    }

    // Use impersonated user ID if impersonating as patient, otherwise use actual user ID
    const effectiveUserId = (impersonationSession?.impersonated_role === 'patient') 
      ? impersonationSession.impersonated_user_id 
      : user.id;

    edgeLogger.info('Effective user ID', { effectiveUserId, isImpersonating: !!impersonationSession });

    // Get patient account and practice info using service role to bypass RLS during impersonation
    const { data: patientAccount, error: patientError } = await supabaseAdmin
      .from('patient_accounts')
      .select(`
        id, 
        practice_id,
        practice:practice_id(name, address_city, address_state)
      `)
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    edgeLogger.info('Patient account lookup', { found: !!patientAccount, hasError: !!patientError });

    if (patientError) {
      edgeLogger.error('Database error', patientError);
      return new Response(JSON.stringify({ error: 'Failed to fetch patient data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!patientAccount) {
      edgeLogger.error('Patient account not found', new Error('Patient account not found'));
      return new Response(JSON.stringify({ error: 'Patient account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Practice is returned as object from foreign key relationship
    const practice = patientAccount.practice as any;
    
    const response = {
      patientAccountId: patientAccount.id,
      practiceId: patientAccount.practice_id,
      practice: practice ? {
        name: practice.name || null,
        city: practice.address_city || null,
        state: practice.address_state || null,
      } : null
    };

    edgeLogger.info('Successfully fetched data', { hasPractice: !!response.practice });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    edgeLogger.error('Unexpected error', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
