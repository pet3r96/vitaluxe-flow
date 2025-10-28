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

    // Get request body
    const { payment_method_id } = await req.json();

    // Validate payment method exists and belongs to practice
    if (payment_method_id) {
      const { data: paymentMethod, error: pmError } = await supabaseClient
        .from('practice_payment_methods')
        .select('*')
        .eq('id', payment_method_id)
        .eq('practice_id', user.id)
        .eq('status', 'active')
        .single();

      if (pmError || !paymentMethod) {
        console.error('Payment method validation error:', pmError);
        return new Response(
          JSON.stringify({ error: "Valid payment method required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if user is a practice (doctor role)
    const { data: userRoles, error: rolesError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError || !userRoles?.some((r: any) => r.role === "doctor")) {
      return new Response(
        JSON.stringify({ error: "Only practices can subscribe to VitaLuxePro" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create subscription using helper function
    const { data: subscription, error: subError } = await supabaseClient.rpc(
      "create_practice_subscription",
      {
        p_practice_id: user.id,
        p_start_trial: true,
      }
    );

    if (subError) {
      console.error("Error creating subscription:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to create subscription", details: subError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Record terms acceptance
    const { data: subscriptionTerms } = await supabaseClient
      .from('terms_and_conditions')
      .select('*')
      .eq('role', 'subscription')
      .single();

    if (subscriptionTerms) {
      await supabaseClient.from('user_terms_acceptances').insert({
        user_id: user.id,
        role: 'subscription',
        terms_version: subscriptionTerms.version,
        signature_name: user.email,
        accepted_at: new Date().toISOString(),
      });
    }

    // Log the subscription creation
    await supabaseClient.from("audit_logs").insert({
      user_id: user.id,
      action_type: "subscription_started",
      entity_type: "practice_subscriptions",
      entity_id: subscription,
      details: {
        subscription_type: "vitaluxepro",
        trial_started: true,
        payment_method_id: payment_method_id || null,
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
