import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';
import { generateSecurePassword } from '../_shared/passwordGenerator.ts';

interface CreatePortalAccountRequest {
  patientId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authToken);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for active impersonation using correct table and columns
    const { data: impersonation } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, expires_at, created_at')
      .eq('admin_user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let effectiveUserId = user.id;
    const isImpersonating = !!impersonation;
    if (impersonation) {
      effectiveUserId = impersonation.impersonated_user_id;
    }

    // Check if effective user is a practice owner, admin, or provider
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', effectiveUserId)
      .in('role', ['doctor', 'admin', 'provider']);

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ 
          code: 'unauthorized_role',
          error: 'Only practice owners, providers, or admins can create portal accounts' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get patientId first to resolve practice context for admins
    const { patientId }: CreatePortalAccountRequest = await req.json();

    if (!patientId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: patientId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-patient-portal-account] Processing request:', {
      authenticatedUser: user.id,
      isImpersonating,
      effectiveUserId,
      roles: roles.map(r => r.role),
      patientId
    });

    // Determine effective practice ID for subscription check
    let effectivePracticeId: string | null = null;
    const isAdminRole = roles.some(r => r.role === 'admin');
    const isDoctorRole = roles.some(r => r.role === 'doctor');
    const isProviderRole = roles.some(r => r.role === 'provider');

    // CRITICAL: For admins not impersonating, immediately fetch patient's practice
    if (isAdminRole && !isImpersonating) {
      console.log('[create-patient-portal-account] Admin (not impersonating) - fetching patient practice context');
      
      const { data: patientData, error: patientError } = await supabaseAdmin
        .from('patient_accounts')
        .select('practice_id, name, email')
        .eq('id', patientId)
        .maybeSingle();
      
      console.log('[create-patient-portal-account] Patient lookup result:', { 
        found: !!patientData,
        practiceId: patientData?.practice_id,
        patientName: patientData?.name,
        error: patientError?.message 
      });
      
      if (patientError) {
        console.error('[create-patient-portal-account] Patient lookup failed:', patientError);
        return new Response(
          JSON.stringify({ 
            error: 'Patient not found',
            details: patientError.message 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!patientData) {
        console.error('[create-patient-portal-account] Patient not found in database');
        return new Response(
          JSON.stringify({ error: 'Patient not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (patientData.practice_id) {
        effectivePracticeId = patientData.practice_id;
        console.log('[create-patient-portal-account] Admin using patient practice context:', { 
          effectivePracticeId,
          patientName: patientData.name
        });
      } else {
        console.error('[create-patient-portal-account] Patient has no practice_id');
        return new Response(
          JSON.stringify({ error: 'Patient is not associated with a practice' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // If admin already got practice context above, skip doctor/provider checks
    if (!effectivePracticeId) {
      // First, check if effective user is a doctor (practice owner)
      const { data: doctorProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', effectiveUserId)
        .maybeSingle();

      if (doctorProfile && isDoctorRole) {
        // Doctor/practice owner - practice_id is their own user_id
        effectivePracticeId = doctorProfile.id;
      } else {
        // Check if they're a provider
        const { data: providerProfile } = await supabaseAdmin
          .from('providers')
          .select('practice_id')
          .eq('user_id', effectiveUserId)
          .maybeSingle();
        
        if (providerProfile && providerProfile.practice_id) {
          effectivePracticeId = providerProfile.practice_id;
        }
      }
    }

    // If no practice context found, return clear error
    if (!effectivePracticeId) {
      console.error('[create-patient-portal-account] No practice context:', {
        authenticatedUser: user.id,
        isImpersonating,
        effectiveUserId,
        roles: roles.map(r => r.role)
      });
      return new Response(
        JSON.stringify({ 
          code: 'no_practice_context',
          error: 'No practice context found. Patient must be associated with a practice.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-patient-portal-account] Context:', {
      authenticatedUser: user.id,
      isImpersonating,
      effectiveUserId,
      effectivePracticeId,
      resolvedAs: isDoctorRole ? 'doctor' : isAdminRole ? 'admin' : 'provider'
    });

    // Check if practice has active subscription (using effective practice)
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('practice_subscriptions')
      .select('status, trial_ends_at, current_period_end')
      .eq('practice_id', effectivePracticeId)
      .in('status', ['active', 'trial', 'trialing'])
      .maybeSingle();

    if (!subscription) {
      console.error('[create-patient-portal-account] Subscription check failed:', {
        effectivePracticeId,
        effectiveUserId,
        isDoctorRole,
        subError,
        timestamp: new Date().toISOString()
      });
      
      // Check if ANY subscription exists for debugging
      const { data: anySubscription } = await supabaseAdmin
        .from('practice_subscriptions')
        .select('status, trial_ends_at, current_period_end, practice_id')
        .eq('practice_id', effectivePracticeId)
        .maybeSingle();
      
      console.error('[create-patient-portal-account] Any subscription found:', anySubscription);
      
      return new Response(
        JSON.stringify({ 
          error: 'VitaLuxePro subscription required to invite patients',
          debug: {
            practiceId: effectivePracticeId,
            subscriptionFound: !!anySubscription,
            subscriptionStatus: anySubscription?.status,
            subscriptionTrial: anySubscription?.trial_ends_at,
            queryError: subError?.message
          }
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[create-patient-portal-account] Subscription verified:', {
      practiceId: effectivePracticeId,
      status: subscription.status
    });

    // Fetch patient record and verify it belongs to effective practice
    console.log('[create-patient-portal-account] Querying patient:', {
      patientId,
      effectivePracticeId,
      timestamp: new Date().toISOString()
    });

    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patient_accounts')
      .select(`
        id,
        user_id,
        practice_id,
        first_name,
        last_name,
        name,
        email,
        phone,
        date_of_birth,
        status,
        address_street,
        address_city,
        address_state,
        address_zip,
        created_at,
        updated_at,
        invitation_sent_at
      `)
      .eq('id', patientId)
      .eq('practice_id', effectivePracticeId)
      .single();

    console.log('[create-patient-portal-account] Patient query result:', {
      found: !!patient,
      error: patientError?.message,
      errorCode: patientError?.code,
      errorDetails: patientError?.details,
      patientId: patient?.id
    });

    if (patientError || !patient) {
      console.error('[create-patient-portal-account] Patient not found:', {
        patientId,
        effectivePracticeId,
        error: patientError,
        queryAttempted: true
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Patient not found',
          debug: {
            patientId,
            practiceId: effectivePracticeId,
            errorMessage: patientError?.message,
            errorCode: patientError?.code,
            errorDetails: patientError?.details
          }
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email
    if (!patient.email) {
      return new Response(
        JSON.stringify({ error: 'Patient does not have an email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(patient.email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = patient.email.trim().toLowerCase();
    console.log('[create-patient-portal-account] Normalized email:', normalizedEmail);

    // Check if patient already has a portal account (case-insensitive)
    const { data: existingAccount } = await supabaseAdmin
      .from('patient_accounts')
      .select('id, user_id, status')
      .eq('practice_id', patient.practice_id)
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (existingAccount) {
      console.log('[create-patient-portal-account] Found existing account, re-inviting:', existingAccount.id);
      
      // If account exists but is not active, reactivate it
      if (existingAccount.status !== 'active') {
        await supabaseAdmin
          .from('patient_accounts')
          .update({ status: 'active' })
          .eq('id', existingAccount.id);
      }

      // Create/refresh temp password token for re-invite
      const reInviteToken = crypto.randomUUID();
      const reInviteExpiresAt = new Date();
      reInviteExpiresAt.setDate(reInviteExpiresAt.getDate() + 7);

      await supabaseAdmin
        .from('temp_password_tokens')
        .insert({
          user_id: existingAccount.user_id,
          token: reInviteToken,
          expires_at: reInviteExpiresAt.toISOString()
        });

      // Update invitation_sent_at
      await supabaseAdmin
        .from('patient_accounts')
        .update({ invitation_sent_at: new Date().toISOString() })
        .eq('id', existingAccount.id);

      // Log audit event for re-invite
      try {
        await supabaseAdmin.rpc('log_audit_event', {
          p_action_type: 'patient_portal_account_reinvited',
          p_entity_type: 'patient_accounts',
          p_entity_id: existingAccount.id,
          p_details: {
            patient_id: patientId,
            practice_id: patient.practice_id,
            created_by: user.id
          }
        });
      } catch (auditError) {
        console.error('Failed to log audit event (reinvite):', auditError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          alreadyHadAccount: true,
          userId: existingAccount.user_id,
          patientAccountId: existingAccount.id,
          token: reInviteToken,
          status: existingAccount.status
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure temporary password
    const temporaryPassword = generateSecurePassword();

    // Check if auth user exists (case-insensitive email lookup)
    let authUserId: string;
    const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers();
    const foundUser = existingAuthUser?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);

    if (foundUser) {
      console.log('[create-patient-portal-account] Found existing auth user:', foundUser.id);
      // User exists in auth, update their password
      authUserId = foundUser.id;
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        { password: temporaryPassword }
      );

      if (passwordError) {
        console.error('Failed to update password:', passwordError);
        throw new Error(`Failed to update password: ${passwordError.message}`);
      }
    } else {
      console.log('[create-patient-portal-account] Creating new auth user for:', normalizedEmail);
      // Create new auth user with normalized email and patient metadata
      const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          name: patient.name,
          role: 'patient'
        }
      });

      if (createAuthError) {
        // Handle case where user already exists but wasn't found in listUsers (pagination issue)
        if (createAuthError.message?.includes('already registered')) {
          console.log('[create-patient-portal-account] User already registered, fetching existing user');
          const { data: retryAuthUser } = await supabaseAdmin.auth.admin.listUsers();
          const retryFoundUser = retryAuthUser?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
          
          if (retryFoundUser) {
            authUserId = retryFoundUser.id;
            // Update password for found user
            await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: temporaryPassword });
          } else {
            console.error('Failed to find user after registration error:', createAuthError);
            throw new Error(`User registration conflict: ${createAuthError.message}`);
          }
        } else {
          console.error('Failed to create auth user:', createAuthError);
          throw new Error(`Failed to create auth user: ${createAuthError.message}`);
        }
      } else if (!newAuthUser.user) {
        throw new Error('Failed to create auth user: No user returned');
      } else {
        authUserId = newAuthUser.user.id;
      }
    }

    // Update existing patient record with user_id to link portal account
    // Do NOT create a new patient record - update the existing one
    const { data: patientAccount, error: accountError } = await supabaseAdmin
      .from('patient_accounts')
      .update({
        user_id: authUserId,
        email: normalizedEmail,
        invitation_sent_at: new Date().toISOString(),
        status: 'active'
      })
      .eq('id', patientId)
      .select()
      .single();

    if (accountError) {
      console.error('Failed to update patient account with user_id:', accountError);
      // Rollback: delete auth user if we just created them
      if (!foundUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      throw new Error(`Failed to update patient account: ${accountError.message}`);
    }

    // Assign patient role with error handling
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authUserId,
        role: 'patient',
      })
      .select()
      .maybeSingle();
    
    if (roleError) {
      console.error('Failed to create patient role (will be created by trigger):', roleError);
      // Don't fail - trigger will handle this
    }

    // Create temp password token for token-based password reset
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiration

    const { error: tokenError } = await supabaseAdmin
      .from('temp_password_tokens')
      .insert({
        user_id: authUserId,
        token: token,
        expires_at: expiresAt.toISOString()
      });

    if (tokenError) {
      console.error('Failed to create temp password token:', tokenError);
      // Don't fail the entire request
    }

    // Log audit event
    try {
      await supabaseAdmin.rpc('log_audit_event', {
        p_action_type: 'patient_portal_account_created',
        p_entity_type: 'patient_accounts',
        p_entity_id: patientAccount.id,
        p_details: {
          patient_id: patientId,
          practice_id: patient.practice_id,
          created_by: user.id,
          email: normalizedEmail
        }
      });
    } catch (auditError) {
      console.error('Failed to log audit event:', auditError);
    }

    console.log('[create-patient-portal-account] Successfully created account:', patientAccount.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        userId: authUserId,
        temporaryPassword: temporaryPassword,
        patientAccountId: patientAccount.id,
        token: token
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in create-patient-portal-account function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to create patient portal account' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
