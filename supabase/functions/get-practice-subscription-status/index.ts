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
