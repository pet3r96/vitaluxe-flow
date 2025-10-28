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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get authenticated user
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

    // Resolve effective practice for subscription
    // Support: practice self, admin impersonating practice or provider, provider self linking to their practice
    console.log('[subscribe-to-vitaluxepro] Start - resolve effective practice');

    // Safely parse body (optional)
    let body: any = null;
    try {
      body = await req.json();
    } catch (_) {
      body = null;
    }
    const payment_method_id = body?.payment_method_id || null;

    const actorUserId = user.id;
    const actorEmail = user.email || null;

    // 1) Check if admin is impersonating someone
    const { data: impSession, error: impErr } = await supabaseClient
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role, expires_at, created_at')
      .eq('admin_user_id', actorUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (impErr) {
      console.warn('[subscribe-to-vitaluxepro] Impersonation lookup error', impErr);
    }

    let practiceId: string | null = null;
    let impersonatedRole: string | null = null;

    const now = new Date();
    if (impSession) {
      const exp = impSession.expires_at ? new Date(impSession.expires_at) : null;
      const isExpired = exp ? exp < now : false;
      if (!isExpired) {
        impersonatedRole = impSession.impersonated_role;
        if (impSession.impersonated_role === 'doctor') {
          practiceId = impSession.impersonated_user_id;
          console.log('[subscribe-to-vitaluxepro] Using impersonated doctor as practice', { practiceId });
        } else if (impSession.impersonated_role === 'provider') {
          const { data: provider, error: provErr } = await supabaseClient
            .from('providers')
            .select('practice_id')
            .eq('user_id', impSession.impersonated_user_id)
            .single();
          if (provErr) {
            console.warn('[subscribe-to-vitaluxepro] Provider lookup failed for impersonated provider', provErr);
          } else if (provider?.practice_id) {
            practiceId = provider.practice_id as string;
            console.log('[subscribe-to-vitaluxepro] Using provider.practice_id from impersonation', { practiceId });
          }
        }
      } else {
        console.log('[subscribe-to-vitaluxepro] Ignoring expired impersonation session');
      }
    }

    // 2) If not impersonating or unresolved, check self role: doctor -> self id
    if (!practiceId) {
      const { data: userRoles, error: rolesError } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', actorUserId);
      if (rolesError) {
        console.warn('[subscribe-to-vitaluxepro] user_roles lookup error', rolesError);
      }
      const roles = (userRoles || []).map((r: any) => r.role);
      if (roles.includes('doctor')) {
        practiceId = actorUserId;
        console.log('[subscribe-to-vitaluxepro] Using self (doctor) as practice', { practiceId });
      }
    }

    // 3) If still unresolved, check if actor is a provider -> resolve provider.practice_id
    if (!practiceId) {
      const { data: selfProvider, error: selfProvErr } = await supabaseClient
        .from('providers')
        .select('practice_id')
        .eq('user_id', actorUserId)
        .single();
      if (!selfProvErr && selfProvider?.practice_id) {
        practiceId = selfProvider.practice_id as string;
        impersonatedRole = impersonatedRole || 'provider';
        console.log('[subscribe-to-vitaluxepro] Using self provider.practice_id', { practiceId });
      }
    }

    if (!practiceId) {
      console.warn('[subscribe-to-vitaluxepro] No valid practice context resolved');
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          details: 'Start trial as a Practice or impersonate a Practice/Provider',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the practice profile exists
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('id', practiceId)
      .single();

    if (profileError || !profile) {
      console.error('[subscribe-to-vitaluxepro] Practice profile not found', profileError);
      return new Response(
        JSON.stringify({ error: 'Practice profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[subscribe-to-vitaluxepro] Effective practice resolved', { practiceId, actorUserId, impersonatedRole });

    // Check if subscription already exists (handle reactivation)
    const { data: existingSub } = await supabaseClient
      .from('practice_subscriptions')
      .select('*')
      .eq('practice_id', practiceId)
      .maybeSingle();

    let subscription;

    if (existingSub) {
      // Subscription exists - reactivate if cancelled or expired
      if (existingSub.status === 'cancelled' || existingSub.status === 'expired') {
        console.log('[subscribe-to-vitaluxepro] Reactivating subscription', existingSub.id);

        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 7);

        const { data: updated, error: updateError } = await supabaseClient
          .from('practice_subscriptions')
          .update({
            status: 'trial',
            trial_ends_at: trialEndsAt.toISOString(),
            cancelled_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSub.id)
          .select()
          .single();

        if (updateError) {
          console.error('[subscribe-to-vitaluxepro] Error reactivating subscription', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to reactivate subscription', details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        subscription = updated.id;
      } else if (existingSub.status === 'active' || existingSub.status === 'trial') {
        return new Response(
          JSON.stringify({ error: 'You already have an active subscription' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Create new subscription using helper function (RPC)
      const { data: newSub, error: subError } = await supabaseClient.rpc(
        'create_practice_subscription',
        {
          p_practice_id: practiceId,
          p_start_trial: true,
        }
      );

      if (subError) {
        console.error('[subscribe-to-vitaluxepro] Error creating subscription', subError);
        return new Response(
          JSON.stringify({ error: 'Failed to create subscription', details: subError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      subscription = newSub;
    }

    // Record terms acceptance (if terms exist)
    const { data: subscriptionTerms } = await supabaseClient
      .from('terms_and_conditions')
      .select('*')
      .eq('role', 'subscription')
      .single();

    if (subscriptionTerms) {
      await supabaseClient.from('user_terms_acceptances').insert({
        user_id: practiceId,
        role: 'subscription',
        terms_version: subscriptionTerms.version,
        signature_name: actorEmail,
        accepted_at: new Date().toISOString(),
      });
    }

    // Log the subscription creation
    await supabaseClient.from('audit_logs').insert({
      user_id: practiceId,
      action_type: 'subscription_started',
      entity_type: 'practice_subscriptions',
      entity_id: subscription,
      details: {
        subscription_type: 'vitaluxepro',
        trial_started: true,
        payment_method_id: payment_method_id,
        payment_method_added: payment_method_id ? true : false,
        actor_user_id: actorUserId,
        actor_email: actorEmail,
        impersonated_role: impersonatedRole,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: subscription,
        message: "7-day free trial started successfully!",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
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
