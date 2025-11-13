import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get all practices with VitaLuxePro subscriptions
    const { data: subscriptions } = await supabaseClient
      .from("practice_subscriptions")
      .select("practice_id")
      .in("status", ["trial", "active"]);

    if (!subscriptions) {
      return new Response(
        JSON.stringify({ message: "No practices found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const sub of subscriptions) {
      const practiceId = sub.practice_id;

      // Count appointments
      const { count: appointmentCount } = await supabaseClient
        .from("patient_appointments")
        .select("*", { count: "exact", head: true })
        .eq("practice_id", practiceId)
        .gte("created_at", yesterdayStr)
        .lt("created_at", today);

      // Count messages sent by practice
      const { count: messagesSent } = await supabaseClient
        .from("patient_messages")
        .select("*", { count: "exact", head: true })
        .eq("practice_id", practiceId)
        .eq("sender_type", "practice")
        .gte("sent_at", yesterdayStr)
        .lt("sent_at", today);

      // Count messages received from patients
      const { count: messagesReceived } = await supabaseClient
        .from("patient_messages")
        .select("*", { count: "exact", head: true })
        .eq("practice_id", practiceId)
        .eq("sender_type", "patient")
        .gte("sent_at", yesterdayStr)
        .lt("sent_at", today);

      // Count triage submissions
      const { count: triageCount } = await supabaseClient
        .from("patient_triage_submissions")
        .select("*", { count: "exact", head: true })
        .eq("practice_id", practiceId)
        .gte("submitted_at", yesterdayStr)
        .lt("submitted_at", today);

      // Count new patients
      const { count: newPatients } = await supabaseClient
        .from("patient_accounts")
        .select("*", { count: "exact", head: true })
        .eq("practice_id", practiceId)
        .gte("created_at", yesterdayStr)
        .lt("created_at", today);

      // Insert metrics snapshot
      const { error } = await supabaseClient
        .from("practice_metrics_snapshot")
        .insert({
          practice_id: practiceId,
          snapshot_date: yesterdayStr,
          total_appointments: appointmentCount || 0,
          messages_sent: messagesSent || 0,
          messages_received: messagesReceived || 0,
          triage_submissions: triageCount || 0,
          new_patients: newPatients || 0
        });

      if (error) {
        console.error(`Error for practice ${practiceId}:`, error);
        results.push({ practiceId, status: "error", error: error.message });
      } else {
        results.push({ practiceId, status: "success" });
      }
    }

    console.log(`Calculated metrics for ${results.length} practices`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Daily metrics calculation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
