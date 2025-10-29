import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    console.log('[send-patient-message] Invoked');
    
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    
    if (!token) {
      console.error('[send-patient-message] Missing authorization token');
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
      console.error('[send-patient-message] Authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[send-patient-message] User authenticated:', user.id);

    // Check for active impersonation session using service role
    const { data: impersonationSession, error: impersonationError } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role')
      .eq('admin_user_id', user.id)
      .maybeSingle();

    if (impersonationError) {
      console.error('[send-patient-message] Impersonation check error:', impersonationError);
    }

    // Use impersonated user ID if impersonating as patient, otherwise use actual user ID
    const isImpersonatingPatient = impersonationSession?.impersonated_role === 'patient';
    const effectiveUserId = isImpersonatingPatient 
      ? impersonationSession.impersonated_user_id 
      : user.id;

    console.log('[send-patient-message] Effective user ID:', effectiveUserId, 'Impersonating:', isImpersonatingPatient);

    const { subject, message } = await req.json();

    if (!message?.trim()) {
      console.error('[send-patient-message] Message body is required');
      return new Response(JSON.stringify({ error: 'Message body is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get patient account using service role to bypass RLS during impersonation
    const { data: patientAccount, error: patientError } = await supabaseAdmin
      .from('patient_accounts')
      .select('id, practice_id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    console.log('[send-patient-message] Patient account lookup:', { patientAccount, error: patientError });

    if (patientError || !patientAccount) {
      console.error('[send-patient-message] Patient account not found');
      return new Response(JSON.stringify({ error: 'Patient account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!patientAccount.practice_id) {
      console.error('[send-patient-message] No practice assigned');
      return new Response(JSON.stringify({ error: 'No practice assigned to your account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const insertPayload = {
      patient_id: patientAccount.id,
      practice_id: patientAccount.practice_id,
      sender_id: effectiveUserId,
      sender_type: 'patient',
      message_body: message,
      subject: subject || 'Patient Message',
      read_at: null
    };

    console.log('[send-patient-message] Attempting to insert message:', insertPayload);

    // Use service role for insert when impersonating, anon client otherwise
    const insertClient = isImpersonatingPatient ? supabaseAdmin : createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { error } = await insertClient
      .from('patient_messages')
      .insert(insertPayload);

    if (error) {
      console.error('[send-patient-message] Database insert error:', error);
      return new Response(JSON.stringify({ error: `Failed to send message: ${error.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[send-patient-message] Message sent successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[send-patient-message] Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
