import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get appointments for tomorrow (24-48 hours from now)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const { data: appointments, error } = await supabase
      .from("patient_appointments")
      .select(`
        id,
        start_time,
        patient_id,
        provider_id,
        practice_id,
        patient_accounts!inner(id, first_name, last_name, phone, email),
        providers!inner(first_name, last_name),
        practices!inner(practice_name, address, city, state, zip)
      `)
      .gte("start_time", tomorrow.toISOString())
      .lt("start_time", dayAfter.toISOString())
      .eq("status", "scheduled");

    if (error) {
      console.error("Error fetching appointments:", error);
      throw error;
    }

    console.log(`Found ${appointments?.length || 0} appointments for reminders`);

    let successCount = 0;
    let errorCount = 0;

    for (const appt of appointments || []) {
      try {
        // Format time nicely
        const apptDate = new Date(appt.start_time);
        const timeString = apptDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit' 
        });
        const dateTimeString = apptDate.toLocaleString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });

        // Create notification
        const { data: notification, error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: appt.patient_id,
            title: "Appointment Reminder",
            message: `You have an appointment tomorrow at ${timeString}`,
            notification_type: "appointment_reminder",
            severity: "info",
            entity_type: "appointment",
            entity_id: appt.id,
            metadata: {
              date_time: dateTimeString,
              time: timeString,
              provider_name: `${appt.providers.first_name} ${appt.providers.last_name}`,
              practice_name: appt.practices.practice_name,
              practice_address: `${appt.practices.address}, ${appt.practices.city}, ${appt.practices.state} ${appt.practices.zip}`
            }
          })
          .select()
          .single();

        if (notifError) {
          console.error("Error creating notification:", notifError);
          errorCount++;
          continue;
        }

        // Trigger send-notification to dispatch via SMS/email
        const { error: sendError } = await supabase.functions.invoke("send-notification", {
          body: {
            notification_id: notification.id,
            send_email: true,
            send_sms: true
          }
        });

        if (sendError) {
          console.error("Error sending notification:", sendError);
          errorCount++;
        } else {
          console.log(`Sent reminder for appointment ${appt.id}`);
          successCount++;
        }
      } catch (err) {
        console.error(`Error processing appointment ${appt.id}:`, err);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: appointments?.length || 0,
        sent: successCount,
        errors: errorCount,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Appointment reminders error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
