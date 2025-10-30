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

    // Create service role client for auth and all operations
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

    // Parse request body
    const { subject, message, sender_type, patient_id } = await req.json();

    // Detect mode: provider reply or patient message
    const isProviderMode = sender_type === 'provider' && patient_id;
    console.log('[send-patient-message] Mode:', isProviderMode ? 'provider' : 'patient');

    // Check for active impersonation session with detailed logging
    const currentTimestamp = new Date().toISOString();
    console.log('[send-patient-message] Checking impersonation for admin user:', user.id, 'at', currentTimestamp);
    
    const { data: impersonationSession, error: impersonationError } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role, expires_at, created_at')
      .eq('admin_user_id', user.id)
      .gt('expires_at', currentTimestamp)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const hasActiveImpersonation = !!impersonationSession && !impersonationError;
    
    console.log('[send-patient-message] Impersonation query result:', { 
      found: hasActiveImpersonation,
      role: impersonationSession?.impersonated_role,
      impersonated_user_id: impersonationSession?.impersonated_user_id,
      expires_at: impersonationSession?.expires_at,
      current_time: currentTimestamp,
      error: impersonationError
    });

    if (impersonationError) {
      console.error('[send-patient-message] Impersonation check error:', impersonationError);
    }

    if (!message?.trim()) {
      console.error('[send-patient-message] Message body is required');
      return new Response(JSON.stringify({ error: 'Message body is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === PROVIDER MODE: Provider replying to patient ===
    if (isProviderMode) {
      console.log('[send-patient-message] PROVIDER MODE - Resolving practice context');
      
      let effectivePracticeId: string | null = null;

      // Resolve practice from impersonation first
      if (impersonationSession?.impersonated_user_id) {
        const role = impersonationSession.impersonated_role;
        const impersonatedId = impersonationSession.impersonated_user_id as string;
        console.log('[send-patient-message] Impersonation active:', { role, impersonatedId });

        if (role === 'patient') {
          // Resolve practice via patient account
          const { data: patientAccount, error: paErr } = await supabaseAdmin
            .from('patient_accounts')
            .select('practice_id')
            .eq('user_id', impersonatedId)
            .maybeSingle();
          if (paErr) console.error('[send-patient-message] Patient account lookup error:', paErr);
          effectivePracticeId = patientAccount?.practice_id ?? null;
          console.log('[send-patient-message] Resolved practice from patient impersonation:', effectivePracticeId);
        } else {
          // Treat impersonated user as practice
          effectivePracticeId = impersonatedId;
          console.log('[send-patient-message] Using impersonated practice:', effectivePracticeId);
        }
      }

      // If no impersonation, resolve from current user
      if (!effectivePracticeId) {
        // Check if user is doctor (practice owner)
        const { data: doctorRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'doctor')
          .maybeSingle();

        if (doctorRole) {
          effectivePracticeId = user.id;
          console.log('[send-patient-message] Resolved practice as doctor:', effectivePracticeId);
        } else {
          // Check provider linkage
          const { data: providerRow } = await supabaseAdmin
            .from('providers')
            .select('practice_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (providerRow?.practice_id) {
            effectivePracticeId = providerRow.practice_id as string;
            console.log('[send-patient-message] Resolved practice via providers:', effectivePracticeId);
          } else {
            // Check practice staff linkage
            const { data: staffRow } = await supabaseAdmin
              .from('practice_staff')
              .select('practice_id')
              .eq('user_id', user.id)
              .maybeSingle();
            if (staffRow?.practice_id) {
              effectivePracticeId = staffRow.practice_id as string;
              console.log('[send-patient-message] Resolved practice via staff:', effectivePracticeId);
            }
          }
        }
      }

      if (!effectivePracticeId) {
        console.error('[send-patient-message] No practice context for provider mode');
        return new Response(
          JSON.stringify({ error: 'No practice context', code: 'no_practice_context' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate patient belongs to this practice
      const { data: patientValidation, error: pvErr } = await supabaseAdmin
        .from('patient_accounts')
        .select('id, practice_id')
        .eq('id', patient_id)
        .maybeSingle();

      console.log('[send-patient-message] Patient validation:', { patientValidation, error: pvErr });

      if (pvErr || !patientValidation || patientValidation.practice_id !== effectivePracticeId) {
        console.error('[send-patient-message] Patient access denied');
        return new Response(
          JSON.stringify({ error: 'Patient not found or access denied', code: 'patient_access_denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert provider message
      const providerPayload = {
        patient_id: patient_id,
        practice_id: effectivePracticeId,
        sender_id: user.id,
        sender_type: 'provider',
        message_body: message,
        subject: subject || 'Provider Message',
        read_at: null
      };

      console.log('[send-patient-message] Inserting provider message:', providerPayload);

      const { error: insertError } = await supabaseAdmin
        .from('patient_messages')
        .insert(providerPayload);

      if (insertError) {
        console.error('[send-patient-message] Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: `Failed to send message: ${insertError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[send-patient-message] Provider message sent successfully');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === PATIENT MODE: Patient sending message ===
    console.log('[send-patient-message] PATIENT MODE - Resolving patient context');
    
    let effectiveUserId = user.id;
    let isImpersonating = false;

    // Check for impersonation and use impersonated user if available
    if (hasActiveImpersonation && impersonationSession?.impersonated_user_id) {
      effectiveUserId = impersonationSession.impersonated_user_id as string;
      isImpersonating = true;
      console.log('[send-patient-message] Admin', user.id, 'impersonating patient user:', effectiveUserId);
    } else {
      console.log('[send-patient-message] No impersonation - using direct user:', effectiveUserId);
    }

    console.log('[send-patient-message] Effective user ID:', effectiveUserId, 'Impersonating:', isImpersonating);

    // Get patient account
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

    // Insert patient message
    const patientPayload = {
      patient_id: patientAccount.id,
      practice_id: patientAccount.practice_id,
      sender_id: effectiveUserId,
      sender_type: 'patient',
      message_body: message,
      subject: subject || 'Patient Message',
      read_at: null
    };

    console.log('[send-patient-message] Inserting patient message:', patientPayload);

    const { error: insertError } = await supabaseAdmin
      .from('patient_messages')
      .insert(patientPayload);

    if (insertError) {
      console.error('[send-patient-message] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: `Failed to send message: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-patient-message] Patient message sent successfully');
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
