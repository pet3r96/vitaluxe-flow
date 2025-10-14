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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, ip_address, user_agent } = await req.json();

    console.log(`Tracking failed login for email: ${email} from IP: ${ip_address}`);

    // Log security event
    await supabaseClient.from("security_events").insert({
      event_type: "failed_login",
      severity: "medium",
      user_email: email,
      ip_address,
      user_agent,
      details: { email, timestamp: new Date().toISOString() },
    });

    // Track failed attempts
    const { data: existing } = await supabaseClient
      .from("failed_login_attempts")
      .select("*")
      .eq("email", email)
      .eq("ip_address", ip_address)
      .gte("last_attempt_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .maybeSingle();

    if (existing) {
      const newCount = existing.attempt_count + 1;
      await supabaseClient
        .from("failed_login_attempts")
        .update({
          attempt_count: newCount,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      console.log(`Updated attempt count to ${newCount} for ${email}`);

      // Check for brute force (5+ attempts in 10 minutes)
      if (newCount >= 5) {
        console.log(`Brute force detected for ${email}, invoking detect-brute-force`);
        await supabaseClient.functions.invoke("detect-brute-force", {
          body: { email, ip_address, attempt_count: newCount },
        });
      }
    } else {
      await supabaseClient.from("failed_login_attempts").insert({
        email,
        ip_address,
        user_agent,
        attempt_count: 1,
      });
      console.log(`Created new failed login attempt record for ${email}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error tracking failed login:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
