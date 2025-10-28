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

    // Determine effective practice ID for subscription check
    let effectivePracticeId: string | null = null;

    // First, check if effective user is a doctor (practice owner)
    const { data: doctorProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', effectiveUserId)
      .maybeSingle();

    // Check if this profile has doctor role
    const isDoctorRole = roles.some(r => r.role === 'doctor');

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
          error: 'No practice context found for this user. Practices must be linked to a doctor account or provider must be assigned to a practice.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-patient-portal-account] Context:', {
      authenticatedUser: user.id,
      isImpersonating,
      effectiveUserId,
      effectivePracticeId,
      resolvedAs: isDoctorRole ? 'doctor' : 'provider'
    });

    // Check if practice has active subscription (using effective practice)
    const { data: subscription } = await supabaseAdmin
      .from('practice_subscriptions')
      .select('status')
      .eq('practice_id', effectivePracticeId)
      .in('status', ['active', 'trial', 'trialing'])
      .maybeSingle();

    if (!subscription) {
      console.log('[create-patient-portal-account] No subscription found for practice:', effectivePracticeId);
      return new Response(
        JSON.stringify({ error: 'VitaLuxePro subscription required to invite patients' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { patientId }: CreatePortalAccountRequest = await req.json();

    if (!patientId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: patientId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch patient record and verify it belongs to effective practice
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .eq('practice_id', effectivePracticeId)
      .single();

    if (patientError || !patient) {
      return new Response(
        JSON.stringify({ error: 'Patient not found' }),
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

    // Check if patient already has a portal account
    const { data: existingAccount } = await supabaseAdmin
      .from('patient_accounts')
      .select('id, user_id, status')
      .eq('email', patient.email)
      .eq('practice_id', patient.practice_id)
      .maybeSingle();

    if (existingAccount) {
      return new Response(
        JSON.stringify({ 
          code: 'already_has_account',
          error: `Patient already has a portal account (status: ${existingAccount.status})`,
          userId: existingAccount.user_id,
          status: existingAccount.status
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure temporary password
    const temporaryPassword = generateSecurePassword();

    // Check if auth user exists
    let authUserId: string;
    const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers();
    const foundUser = existingAuthUser?.users?.find(u => u.email === patient.email);

    if (foundUser) {
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
      // Create new auth user
      const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: patient.email,
        password: temporaryPassword,
        email_confirm: true,
      });

      if (createAuthError || !newAuthUser.user) {
        console.error('Failed to create auth user:', createAuthError);
        throw new Error(`Failed to create auth user: ${createAuthError?.message}`);
      }

      authUserId = newAuthUser.user.id;
    }

    // Create patient_accounts record
    // Status defaults to 'active' - invitation state tracked by last_login_at being null
    const { data: patientAccount, error: accountError } = await supabaseAdmin
      .from('patient_accounts')
      .insert({
        user_id: authUserId,
        practice_id: patient.practice_id,
        first_name: patient.name.split(' ')[0] || patient.name,
        last_name: patient.name.split(' ').slice(1).join(' ') || '',
        email: patient.email,
        phone: patient.phone,
        date_of_birth: patient.date_of_birth,
        address: patient.address,
        city: patient.city,
        state: patient.state,
        zip_code: patient.zip_code,
        // Omit status field - defaults to 'active'
      })
      .select()
      .single();

    if (accountError) {
      console.error('Failed to create patient account:', accountError);
      // Rollback: delete auth user if we just created them
      if (!foundUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      throw new Error(`Failed to create patient account: ${accountError.message}`);
    }

    // Assign patient role
    await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authUserId,
        role: 'patient',
      })
      .select()
      .maybeSingle();

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
          created_by: user.id
        }
      });
    } catch (auditError) {
      console.error('Failed to log audit event:', auditError);
    }

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
