import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { generateSecurePassword } from '../_shared/passwordGenerator.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { hasRole } from '../_shared/roleChecker.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateRequestSize } from '../_shared/requestSizeValidator.ts';
import { createPatientPortalAccountSchema, validateInput } from '../_shared/zodSchemas.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';

interface CreatePortalAccountRequest {
  patientId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const ipAddress = getClientIP(req);

  try {
    // PHASE 3: Request size validation
    const sizeValidation = validateRequestSize(req, 'create-patient-portal-account', corsHeaders);
    if (sizeValidation) return sizeValidation;

    const supabaseAdmin = createAdminClient();

    // PHASE 3: Rate limiting (3 attempts per hour per IP to prevent abuse)
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      ipAddress,
      'create-patient-portal-account',
      { maxRequests: 3, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { ipAddress, function: 'create-patient-portal-account' });
      return new Response(
        JSON.stringify({ error: 'Too many account creation attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Check if effective user is a practice owner, admin, provider, or staff
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', effectiveUserId)
      .in('role', ['doctor', 'admin', 'provider', 'staff']);

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ 
          code: 'unauthorized_role',
          error: 'Only practice owners, providers, staff, or admins can create portal accounts' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabaseAdmin, user.id, csrfToken);
    if (!valid) {
      edgeLogger.error('CSRF validation failed', new Error(csrfError || 'Invalid CSRF token'), { userId: user.id });
      return new Response(
        JSON.stringify({ error: csrfError || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get patientId from raw body
    const body = await req.json();
    const patientId = body.patientId;

    if (!patientId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: patientId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 3: ID validation
    const { valid: ownsResource, error: idError } = await validateUserOwnsResource(
      supabaseAdmin,
      effectiveUserId,
      'patient',
      patientId
    );

    if (!ownsResource) {
      edgeLogger.error('ID validation failed', undefined, { error: idError, userId: effectiveUserId, patientId });
      return new Response(
        JSON.stringify({ error: idError || 'Access denied to this patient' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('[PATIENT PORTAL] Starting account creation', {
      authenticatedUser: user.id,
      isImpersonating,
      effectiveUserId,
      roles: roles.map(r => r.role),
      patientId,
      timestamp: new Date().toISOString()
    });

    // Determine effective practice ID for subscription check
    let effectivePracticeId: string | null = null;
    const isAdminRole = await hasRole(supabaseAdmin, effectiveUserId, ['admin']);
    const isDoctorRole = await hasRole(supabaseAdmin, effectiveUserId, ['doctor']);
    const isProviderRole = await hasRole(supabaseAdmin, effectiveUserId, ['provider']);
    const isStaffRole = await hasRole(supabaseAdmin, effectiveUserId, ['staff']);

    // CRITICAL: For admins not impersonating, immediately fetch patient's practice
    if (isAdminRole && !isImpersonating) {
      edgeLogger.info('[create-patient-portal-account] Admin (not impersonating) - fetching patient practice context');
      
      const { data: patientData, error: patientError } = await supabaseAdmin
        .from('patient_accounts')
        .select('practice_id, name, email')
        .eq('id', patientId)
        .maybeSingle();

      edgeLogger.info('Patient lookup result', {
        found: !!patientData,
        practiceId: patientData?.practice_id,
        patientName: patientData?.name,
        error: patientError?.message 
      });

      if (patientError) {
        edgeLogger.error('Patient lookup failed', patientError);
        return new Response(
          JSON.stringify({ 
            error: 'Patient not found',
            details: patientError.message 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!patientData) {
        edgeLogger.error('[create-patient-portal-account] Patient not found in database');
        return new Response(
          JSON.stringify({ error: 'Patient not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (patientData.practice_id) {
        effectivePracticeId = patientData.practice_id;
        edgeLogger.info('[create-patient-portal-account] Admin using patient practice context', { 
          effectivePracticeId,
          patientName: patientData.name
        });
      } else {
        edgeLogger.error('Patient has no practice_id', new Error('Patient missing practice_id'));
        return new Response(
          JSON.stringify({ error: 'Patient is not associated with a practice' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // If admin already got practice context above, skip doctor/provider/staff checks
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
      } else if (isStaffRole) {
        // Check if they're staff
        const { data: staffProfile } = await supabaseAdmin
          .from('practice_staff')
          .select('practice_id')
          .eq('user_id', effectiveUserId)
          .eq('active', true)
          .maybeSingle();
        
        if (staffProfile && staffProfile.practice_id) {
          effectivePracticeId = staffProfile.practice_id;
        }
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
      edgeLogger.error('[create-patient-portal-account] No practice context', null, {
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

    edgeLogger.info('[create-patient-portal-account] Context', {
      authenticatedUser: user.id,
      isImpersonating,
      effectiveUserId,
      effectivePracticeId,
      resolvedAs: isDoctorRole ? 'doctor' : isAdminRole ? 'admin' : isStaffRole ? 'staff' : 'provider'
    });

    // Check if practice has active subscription (using effective practice)
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('practice_subscriptions')
      .select('status, trial_ends_at, current_period_end')
      .eq('practice_id', effectivePracticeId)
      .in('status', ['active', 'trial', 'trialing'])
      .maybeSingle();

    if (!subscription) {
      edgeLogger.error('[create-patient-portal-account] Subscription check failed', null, {
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

      edgeLogger.error('Any subscription found', new Error('Subscription missing or invalid'), { anySubscription: !!anySubscription });
      
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

    edgeLogger.info('Subscription verified', {
      practiceId: effectivePracticeId,
      status: subscription.status
    });

    // Fetch patient record and verify it belongs to effective practice
    edgeLogger.info('[create-patient-portal-account] Querying patient', {
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
      .maybeSingle();

    edgeLogger.info('Patient query result', {
      found: !!patient,
      error: patientError?.message,
      errorCode: patientError?.code,
      errorDetails: patientError?.details,
      patientId: patient?.id,
      practiceMatch: patient?.practice_id === effectivePracticeId
    });

    if (patientError || !patient) {
      edgeLogger.error('[create-patient-portal-account] Patient not found', patientError, {
        patientId,
        effectivePracticeId,
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

    // Ensure the patient belongs to the effective practice
    if (patient.practice_id !== effectivePracticeId) {
      edgeLogger.error('[create-patient-portal-account] Patient not in practice context', null, {
        patientId: patient.id,
        patientPracticeId: patient.practice_id,
        effectivePracticeId
      });
      return new Response(
        JSON.stringify({ 
          error: 'Patient not associated with this practice',
          debug: {
            patientId: patient.id,
            patientPracticeId: patient.practice_id,
            effectivePracticeId
          }
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    edgeLogger.info('[create-patient-portal-account] Normalized email', { normalizedEmail });

    // Check if patient already has a portal account (case-insensitive)
    // CRITICAL: Only match accounts that have a linked auth user (user_id is not null)
    const { data: existingAccount } = await supabaseAdmin
      .from('patient_accounts')
      .select('id, user_id, status')
      .eq('practice_id', patient.practice_id)
      .ilike('email', normalizedEmail)
      .not('user_id', 'is', null)
      .maybeSingle();

    edgeLogger.info('[create-patient-portal-account] Existing account check', {
      found: !!existingAccount,
      hasUserId: !!existingAccount?.user_id,
      accountId: existingAccount?.id
    });

    if (existingAccount) {
      edgeLogger.info('[create-patient-portal-account] Found existing account with user_id, re-inviting', { accountId: existingAccount.id });
      
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
        edgeLogger.error('Failed to log audit event (reinvite)', auditError instanceof Error ? auditError : new Error(String(auditError)));
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
    const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      edgeLogger.error('[create-patient-portal-account] Failed to list auth users', listError);
    }
    const foundUser = allUsers?.find(u => u.email?.toLowerCase() === normalizedEmail);

    if (foundUser) {
      edgeLogger.info('[create-patient-portal-account] Found existing auth user', { authUserId: foundUser.id });
      // User exists in auth, update their password
      authUserId = foundUser.id;
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        { password: temporaryPassword }
      );

      if (passwordError) {
        edgeLogger.error('Failed to update password', passwordError);
        throw new Error(`Failed to update password: ${passwordError.message}`);
      }
    } else {
      edgeLogger.info('[PATIENT PORTAL] Creating new auth user', {
        email: normalizedEmail,
        patientId,
        patientName: patient.name
      });
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
          edgeLogger.info('[PATIENT PORTAL] User already registered, fetching existing user');
          const { data: retryAuthUser } = await supabaseAdmin.auth.admin.listUsers();
          const retryFoundUser = retryAuthUser?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
          
          if (retryFoundUser) {
            authUserId = retryFoundUser.id;
            // Update password for found user
            await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: temporaryPassword });
            edgeLogger.info('[PATIENT PORTAL] Found and updated existing auth user', { authUserId });
          } else {
            edgeLogger.error('[PATIENT PORTAL] Failed to find user after registration error', createAuthError);
            throw new Error(`User registration conflict: ${createAuthError.message}`);
            }
          } else {
            edgeLogger.error('Failed to create auth user', createAuthError);
          throw new Error(`Failed to create auth user: ${createAuthError.message}`);
        }
      } else if (!newAuthUser.user) {
        throw new Error('Failed to create auth user: No user returned');
      } else {
        authUserId = newAuthUser.user.id;
        edgeLogger.info('[PATIENT PORTAL] Auth user created successfully', {
          authUserId,
          email: normalizedEmail,
          patientId
        });
      }
    }

    // Update existing patient record with user_id to link portal account
    // Do NOT create a new patient record - update the existing one
    edgeLogger.info('[PATIENT PORTAL] Linking patient account to auth user', {
      patientId,
      authUserId,
      email: normalizedEmail
    });

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
      edgeLogger.error('[PATIENT PORTAL] Failed to link patient account', accountError, {
        patientId,
        authUserId,
        code: accountError.code
      });
      // Rollback: delete auth user if we just created them
      if (!foundUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      throw new Error(`Failed to update patient account: ${accountError.message}`);
    }

    edgeLogger.info('[PATIENT PORTAL] Patient account linked successfully', {
      patientAccountId: patientAccount.id,
      authUserId,
      email: normalizedEmail,
      invitation_sent_at: patientAccount.invitation_sent_at
    });

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
      edgeLogger.error('Failed to create patient role (will be created by trigger)', roleError);
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
      edgeLogger.error('Failed to create temp password token', tokenError);
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
      edgeLogger.error('Failed to log audit event', auditError instanceof Error ? auditError : new Error(String(auditError)));
    }

    edgeLogger.info('Account creation completed successfully', {
      patientAccountId: patientAccount.id,
      authUserId,
      email: normalizedEmail,
      practiceId: patient.practice_id,
      timestamp: new Date().toISOString()
    });

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

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    edgeLogger.error('[PATIENT PORTAL] Error occurred', error, {
      errorMessage,
      errorStack,
      timestamp: new Date().toISOString()
    });
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage || 'Failed to create patient portal account'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
