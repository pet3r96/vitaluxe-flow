import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    
    if (!token) throw new Error('Missing authorization token');

    // Create service role client for auth and impersonation queries
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user authentication
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error('Not authenticated');

    console.log('User authenticated:', user.id);

    // Check for active impersonation session using service role
    const { data: impersonationSession, error: impersonationError } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role')
      .eq('admin_user_id', user.id)
      .maybeSingle();

    if (impersonationError) {
      console.error('Impersonation check error:', impersonationError);
    }

    // Use impersonated user ID if impersonating as patient, otherwise use actual user ID
    const effectiveUserId = (impersonationSession?.impersonated_role === 'patient') 
      ? impersonationSession.impersonated_user_id 
      : user.id;

    console.log('Effective user ID:', effectiveUserId, 'Impersonating:', !!impersonationSession);

    // Create authenticated client for data operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { subject, message } = await req.json();

    if (!message?.trim()) throw new Error('Message body is required');

    // Get patient account to find their practice_id and patient_id
    const { data: patientAccount, error: patientError } = await supabaseClient
      .from('patient_accounts')
      .select('id, practice_id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    console.log('Patient account lookup:', { patientAccount, error: patientError });

    if (patientError || !patientAccount) {
      throw new Error('Patient account not found');
    }

    if (!patientAccount.practice_id) {
      throw new Error('No practice assigned to your account');
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

    console.log('Attempting to insert message:', insertPayload);

    const { error } = await supabaseClient
      .from('patient_messages')
      .insert(insertPayload);

    if (error) {
      console.error('Database insert error:', error);
      throw new Error(`Failed to send message: ${error.message || 'Unknown database error'}`);
    }

    console.log('Message sent successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
