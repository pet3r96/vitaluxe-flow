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

    console.log("Starting alert system test...");
    const results: any[] = [];

    // Test 1: Direct trigger-alert call (security alert)
    try {
      const securityAlertResult = await supabaseClient.functions.invoke("trigger-alert", {
        body: {
          event_type: "failed_login",
          severity: "high",
          message: "Test: Multiple failed login attempts detected",
          details: { test: true, ip_address: "192.168.1.1", attempts: 5 }
        }
      });
      results.push({
        test: "Direct Security Alert",
        success: !securityAlertResult.error,
        data: securityAlertResult.data,
        error: securityAlertResult.error?.message
      });
      console.log("Test 1 (Direct trigger-alert):", securityAlertResult.data);
    } catch (e) {
      results.push({ test: "Direct Security Alert", success: false, error: e.message });
    }

    // Test 2: Create a test appointment (should trigger appointment_new)
    try {
      // Get first patient and practice for testing
      const { data: patients } = await supabaseClient
        .from("patient_accounts")
        .select("id, practice_id")
        .limit(1)
        .single();

      if (patients) {
        const { data: appointment, error: apptError } = await supabaseClient
          .from("patient_appointments")
          .insert({
            practice_id: patients.practice_id,
            patient_id: patients.id,
            start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            end_time: new Date(Date.now() + 90000000).toISOString(), // Tomorrow + 1 hour
            status: "scheduled",
            service_type: "consultation"
          })
          .select()
          .single();

        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for trigger

        results.push({
          test: "Appointment Creation Alert",
          success: !apptError,
          appointmentId: appointment?.id,
          error: apptError?.message
        });
        console.log("Test 2 (Appointment):", appointment?.id);
      } else {
        results.push({
          test: "Appointment Creation Alert",
          success: false,
          error: "No patient found for testing"
        });
      }
    } catch (e) {
      results.push({ test: "Appointment Creation Alert", success: false, error: e.message });
    }

    // Test 3: Create a test patient message (should trigger patient_message)
    try {
      const { data: threads } = await supabaseClient
        .from("message_threads")
        .select("id")
        .limit(1)
        .single();

      const { data: patient } = await supabaseClient
        .from("patient_accounts")
        .select("id")
        .limit(1)
        .single();

      if (threads && patient) {
        const { data: message, error: msgError } = await supabaseClient
          .from("internal_messages")
          .insert({
            thread_id: threads.id,
            sender_id: patient.id,
            subject: "Test Patient Message",
            body: "This is a test message from patient to trigger alert"
          })
          .select()
          .single();

        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for trigger

        results.push({
          test: "Patient Message Alert",
          success: !msgError,
          messageId: message?.id,
          error: msgError?.message
        });
        console.log("Test 3 (Patient Message):", message?.id);
      } else {
        results.push({
          test: "Patient Message Alert",
          success: false,
          error: "No thread or patient found for testing"
        });
      }
    } catch (e) {
      results.push({ test: "Patient Message Alert", success: false, error: e.message });
    }

    // Test 4: Create a test document upload (should trigger document_uploaded)
    try {
      const { data: patient } = await supabaseClient
        .from("patient_accounts")
        .select("id")
        .limit(1)
        .single();

      if (patient) {
        const { data: document, error: docError } = await supabaseClient
          .from("patient_documents")
          .insert({
            patient_id: patient.id,
            document_type: "medical_record",
            document_name: "test_document.pdf",
            storage_path: "test/path/document.pdf",
            uploaded_at: new Date().toISOString()
          })
          .select()
          .single();

        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for trigger

        results.push({
          test: "Document Upload Alert",
          success: !docError,
          documentId: document?.id,
          error: docError?.message
        });
        console.log("Test 4 (Document Upload):", document?.id);
      } else {
        results.push({
          test: "Document Upload Alert",
          success: false,
          error: "No patient found for testing"
        });
      }
    } catch (e) {
      results.push({ test: "Document Upload Alert", success: false, error: e.message });
    }

    // Test 5: Update subscription status (should trigger subscription_status_change)
    try {
      const { data: subscription } = await supabaseClient
        .from("practice_subscriptions")
        .select("id, practice_id, status")
        .limit(1)
        .single();

      if (subscription) {
        const newStatus = subscription.status === "active" ? "trial" : "active";
        const { data: updatedSub, error: subError } = await supabaseClient
          .from("practice_subscriptions")
          .update({ status: newStatus })
          .eq("id", subscription.id)
          .select()
          .single();

        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for trigger

        results.push({
          test: "Subscription Status Change Alert",
          success: !subError,
          subscriptionId: updatedSub?.id,
          statusChange: `${subscription.status} -> ${newStatus}`,
          error: subError?.message
        });
        console.log("Test 5 (Subscription):", updatedSub?.id);

        // Revert the status change
        await supabaseClient
          .from("practice_subscriptions")
          .update({ status: subscription.status })
          .eq("id", subscription.id);
      } else {
        results.push({
          test: "Subscription Status Change Alert",
          success: false,
          error: "No subscription found for testing"
        });
      }
    } catch (e) {
      results.push({ test: "Subscription Status Change Alert", success: false, error: e.message });
    }

    // Test 6: Update order line status to delivered (should trigger order_delivered)
    try {
      const { data: orderLine } = await supabaseClient
        .from("order_lines")
        .select("id, status")
        .neq("status", "delivered")
        .limit(1)
        .single();

      if (orderLine) {
        const { data: updatedLine, error: lineError } = await supabaseClient
          .from("order_lines")
          .update({ status: "delivered" })
          .eq("id", orderLine.id)
          .select()
          .single();

        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for trigger

        results.push({
          test: "Order Delivered Alert",
          success: !lineError,
          orderLineId: updatedLine?.id,
          statusChange: `${orderLine.status} -> delivered`,
          error: lineError?.message
        });
        console.log("Test 6 (Order Delivered):", updatedLine?.id);

        // Revert the status
        await supabaseClient
          .from("order_lines")
          .update({ status: orderLine.status })
          .eq("id", orderLine.id);
      } else {
        results.push({
          test: "Order Delivered Alert",
          success: false,
          error: "No order line found for testing"
        });
      }
    } catch (e) {
      results.push({ test: "Order Delivered Alert", success: false, error: e.message });
    }

    // Wait a bit and then query the alerts table
    await new Promise(resolve => setTimeout(resolve, 3000));

    const { data: alerts, error: alertsError } = await supabaseClient
      .from("alerts")
      .select("*")
      .order("triggered_at", { ascending: false })
      .limit(10);

    console.log("Alert system test completed. Results:", results);
    console.log("Recent alerts in database:", alerts);

    return new Response(
      JSON.stringify({
        success: true,
        testResults: results,
        recentAlerts: alerts,
        summary: {
          totalTests: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error in test-alerts:", error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});