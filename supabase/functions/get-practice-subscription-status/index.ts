import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check with user's JWT
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for DB operations (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const actorUserId = user.id;
    console.log('[get-practice-subscription-status] Actor user:', actorUserId);

    // Parse optional practiceId hint from request body
    let hintedPracticeId: string | null = null;
    try {
      const body = await req.json();
      if (body?.practiceId) {
        hintedPracticeId = body.practiceId;
        console.log('[get-practice-subscription-status] Received practiceId hint:', hintedPracticeId);
      }
    } catch {
      // No body or invalid JSON, continue without hint
    }

    // Resolve effective practice using same logic as subscribe-to-vitaluxepro
    let practiceId: string | null = null;

    // 1) Check if admin is impersonating
    const { data: impSession, error: impErr } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role, expires_at')
      .eq('admin_user_id', actorUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (impErr) {
      console.warn('[get-practice-subscription-status] Impersonation lookup error', impErr);
    }

    const now = new Date();
    if (impSession) {
      const exp = impSession.expires_at ? new Date(impSession.expires_at) : null;
      const isExpired = exp ? exp < now : false;
      if (!isExpired) {
        if (impSession.impersonated_role === 'doctor') {
          practiceId = impSession.impersonated_user_id;
          console.log('[get-practice-subscription-status] Using impersonated doctor as practice', { practiceId });
        } else if (impSession.impersonated_role === 'provider') {
          const { data: provider, error: provErr } = await supabaseAdmin
            .from('providers')
            .select('practice_id')
            .eq('user_id', impSession.impersonated_user_id)
            .single();
          if (!provErr && provider?.practice_id) {
            practiceId = provider.practice_id as string;
            console.log('[get-practice-subscription-status] Using provider.practice_id from impersonation', { practiceId });
          }
        } else if (impSession.impersonated_role === 'staff') {
          const { data: staff, error: staffErr } = await supabaseAdmin
            .from('practice_staff')
            .select('practice_id')
            .eq('user_id', impSession.impersonated_user_id)
            .maybeSingle();
          if (!staffErr && staff?.practice_id) {
            practiceId = staff.practice_id as string;
            console.log('[get-practice-subscription-status] Using practice_staff.practice_id from impersonation', { practiceId });
          }
        }
      }
    }

    // 2) If not impersonating, check if self is doctor
    if (!practiceId) {
      const { data: userRoles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', actorUserId);
      if (!rolesError) {
        const roles = (userRoles || []).map((r: any) => r.role);
        if (roles.includes('doctor')) {
          practiceId = actorUserId;
          console.log('[get-practice-subscription-status] Using self (doctor) as practice', { practiceId });
        }
      }
    }

    // 3) Check if self is provider
    if (!practiceId) {
      const { data: selfProvider, error: selfProvErr } = await supabaseAdmin
        .from('providers')
        .select('practice_id')
        .eq('user_id', actorUserId)
        .single();
      if (!selfProvErr && selfProvider?.practice_id) {
        practiceId = selfProvider.practice_id as string;
        console.log('[get-practice-subscription-status] Using self provider.practice_id', { practiceId });
      }
    }

    // 4) Check if self is staff member
    if (!practiceId) {
      const { data: selfStaff, error: selfStaffErr } = await supabaseAdmin
        .from('practice_staff')
        .select('practice_id')
        .eq('user_id', actorUserId)
        .maybeSingle();
      if (!selfStaffErr && selfStaff?.practice_id) {
        practiceId = selfStaff.practice_id as string;
        console.log('[get-practice-subscription-status] Using self practice_staff.practice_id', { practiceId });
      }
    }

    // 5) Validate and use hinted practiceId if still not resolved
    if (!practiceId && hintedPracticeId) {
      console.log('[get-practice-subscription-status] Validating hinted practiceId', { hintedPracticeId });
      
      // Validate that actor is legitimately related to this practice
      let isValid = false;

      // Check if impersonation session relates to this practice
      if (impSession && !isValid) {
        const exp = impSession.expires_at ? new Date(impSession.expires_at) : null;
        const isExpired = exp ? exp < new Date() : false;
        if (!isExpired) {
          if (impSession.impersonated_role === 'doctor' && impSession.impersonated_user_id === hintedPracticeId) {
            isValid = true;
          } else if (impSession.impersonated_role === 'provider') {
            const { data: impProvider } = await supabaseAdmin
              .from('providers')
              .select('practice_id')
              .eq('user_id', impSession.impersonated_user_id)
              .eq('practice_id', hintedPracticeId)
              .maybeSingle();
            if (impProvider) isValid = true;
          } else if (impSession.impersonated_role === 'staff') {
            const { data: impStaff } = await supabaseAdmin
              .from('practice_staff')
              .select('practice_id')
              .eq('user_id', impSession.impersonated_user_id)
              .eq('practice_id', hintedPracticeId)
              .maybeSingle();
            if (impStaff) isValid = true;
          }
        }
      }

      // Check if actor is directly a doctor with matching id
      if (!isValid && actorUserId === hintedPracticeId) {
        const { data: userRoles } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', actorUserId);
        if (userRoles?.some((r: any) => r.role === 'doctor')) {
          isValid = true;
        }
      }

      // Check if actor is provider/staff related to this practice
      if (!isValid) {
        const { data: actorProvider } = await supabaseAdmin
          .from('providers')
          .select('practice_id')
          .eq('user_id', actorUserId)
          .eq('practice_id', hintedPracticeId)
          .maybeSingle();
        if (actorProvider) isValid = true;
      }

      if (!isValid) {
        const { data: actorStaff } = await supabaseAdmin
          .from('practice_staff')
          .select('practice_id')
          .eq('user_id', actorUserId)
          .eq('practice_id', hintedPracticeId)
          .maybeSingle();
        if (actorStaff) isValid = true;
      }

      if (isValid) {
        practiceId = hintedPracticeId;
        console.log('[get-practice-subscription-status] Using validated hinted practiceId', { practiceId });
      } else {
        console.warn('[get-practice-subscription-status] Hinted practiceId failed validation', { hintedPracticeId });
      }
    }

    if (!practiceId) {
      console.log('[get-practice-subscription-status] No valid practice context resolved');
      return new Response(
        JSON.stringify({
          isSubscribed: false,
          status: null,
          trialEndsAt: null,
          currentPeriodEnd: null,
          trialDaysRemaining: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch subscription using service role
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('practice_subscriptions')
      .select('*')
      .eq('practice_id', practiceId)
      .maybeSingle();

    if (subError) {
      console.error('[get-practice-subscription-status] Error fetching subscription', subError);
      throw subError;
    }

    console.log('[get-practice-subscription-status] Subscription found:', subscription);

    if (!subscription) {
      return new Response(
        JSON.stringify({
          isSubscribed: false,
          status: null,
          trialEndsAt: null,
          currentPeriodEnd: null,
          trialDaysRemaining: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isActive = subscription.status === 'active' || subscription.status === 'trial';
    let trialDaysRemaining = null;

    if (subscription.status === 'trial' && subscription.trial_ends_at) {
      const trialEnd = new Date(subscription.trial_ends_at);
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      trialDaysRemaining = Math.max(0, daysLeft);
    }

    return new Response(
      JSON.stringify({
        isSubscribed: isActive,
        status: subscription.status,
        trialEndsAt: subscription.trial_ends_at,
        currentPeriodEnd: subscription.current_period_end,
        trialDaysRemaining,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[get-practice-subscription-status] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
