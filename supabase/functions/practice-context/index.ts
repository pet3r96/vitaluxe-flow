import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

console.log('[practice-context] Function loaded');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[practice-context] Missing Authorization header');
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: 'unauthorized',
          message: 'Authorization header required' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('[practice-context] Auth error:', authError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: 'unauthorized',
          message: 'Invalid authentication' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for impersonation
    const { data: impersonationSession } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role')
      .eq('admin_user_id', user.id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    const effectiveUserId = impersonationSession?.impersonated_user_id || user.id;
    const effectiveRole = impersonationSession?.impersonated_role;

    console.log('[practice-context] User:', user.id, 'Effective:', effectiveUserId, 'Role:', effectiveRole);

    let practiceId: string | null = null;
    let roleContext: string = 'unknown';

    // RESOLUTION LOGIC: Try patient first, then doctor/provider/staff
    
    // 1. Check if user is a patient
    const { data: patientAccount } = await supabaseAdmin
      .from('patient_accounts')
      .select('id, practice_id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    if (patientAccount?.practice_id) {
      practiceId = patientAccount.practice_id;
      roleContext = 'patient';
      console.log('[practice-context] Resolved as patient:', patientAccount.id, 'practice:', practiceId);
    }

    // 2. Check if user is a doctor (practice owner)
    if (!practiceId) {
      const { data: userRoles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', effectiveUserId)
        .eq('role', 'doctor')
        .maybeSingle();

      if (userRoles) {
        practiceId = effectiveUserId;
        roleContext = 'doctor';
        console.log('[practice-context] Resolved as doctor (practice owner):', practiceId);
      }
    }

    // 3. Check if user is a provider
    if (!practiceId) {
      const { data: provider } = await supabaseAdmin
        .from('providers')
        .select('practice_id')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (provider?.practice_id) {
        practiceId = provider.practice_id;
        roleContext = 'provider';
        console.log('[practice-context] Resolved as provider, practice:', practiceId);
      }
    }

    // 4. Check if user is staff - use practice_staff table
    if (!practiceId) {
      const { data: staff } = await supabaseAdmin
        .from('practice_staff')
        .select('practice_id')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (staff?.practice_id) {
        practiceId = staff.practice_id;
        roleContext = 'staff';
        console.log('[practice-context] Resolved as staff, practice:', practiceId);
      }
    }

    // 5. Check if admin with no specific practice link
    if (!practiceId) {
      const { data: adminRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (adminRole) {
        roleContext = 'admin';
        console.log('[practice-context] User is admin with no specific practice');
        return new Response(
          JSON.stringify({
            success: false,
            reason: 'no_practice_assigned',
            message: 'Admin user without specific practice context',
            roleContext: 'admin'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // If no practice found, return not-found state
    if (!practiceId) {
      console.log('[practice-context] No practice found for user:', effectiveUserId);
      return new Response(
        JSON.stringify({
          success: false,
          reason: roleContext === 'patient' ? 'patient_not_linked_to_practice' : 'no_practice_assigned',
          message: 'No practice association found',
          roleContext
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch practice details
    const { data: practice, error: practiceError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, address_city, address_state')
      .eq('id', practiceId)
      .single();

    if (practiceError || !practice) {
      console.error('[practice-context] Practice fetch error:', practiceError);
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'practice_not_found',
          message: 'Practice profile not found'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch subscription status
    const { data: subscription } = await supabaseAdmin
      .from('practice_subscriptions')
      .select('*')
      .eq('practice_id', practiceId)
      .maybeSingle();

    let subscriptionStatus = {
      status: 'no_subscription' as string,
      isSubscribed: false,
      trialEndsAt: null as string | null,
      currentPeriodEnd: null as string | null,
      gracePeriodEndsAt: null as string | null
    };

    if (subscription) {
      const now = new Date();
      const status = subscription.status;
      const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
      const gracePeriodEnd = subscription.grace_period_ends_at ? new Date(subscription.grace_period_ends_at) : null;

      // Strict subscription logic: only 'active' or 'trial' with valid period
      const isActive = status === 'active' && currentPeriodEnd && currentPeriodEnd > now;
      const isTrial = status === 'trial' && subscription.trial_ends_at && new Date(subscription.trial_ends_at) > now;
      const isInGracePeriod = status === 'suspended' && gracePeriodEnd && gracePeriodEnd > now;

      subscriptionStatus = {
        status,
        isSubscribed: !!(isActive || isTrial || isInGracePeriod),
        trialEndsAt: subscription.trial_ends_at,
        currentPeriodEnd: subscription.current_period_end,
        gracePeriodEndsAt: subscription.grace_period_ends_at
      };
    }

    console.log('[practice-context] Final result:', {
      practiceId,
      practiceName: practice.name,
      roleContext,
      subscriptionStatus: subscriptionStatus.status,
      isSubscribed: subscriptionStatus.isSubscribed
    });

    return new Response(
      JSON.stringify({
        success: true,
        practice: {
          id: practice.id,
          name: practice.name,
          city: practice.address_city,
          state: practice.address_state
        },
        subscription: subscriptionStatus,
        roleContext
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[practice-context] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        reason: 'internal_error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
