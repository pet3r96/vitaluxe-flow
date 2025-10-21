import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Client for auth verification (with user JWT)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Admin client for deletions (service role, NO JWT - bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin role
    const { data: roleCheck, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleCheck) {
      console.error("Non-admin user attempted deletion:", user.email);
      return new Response(
        JSON.stringify({ error: "Access denied: admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    if (body.confirm !== "DELETE ALL ORDERS") {
      return new Response(
        JSON.stringify({ error: "Confirmation text required: DELETE ALL ORDERS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Admin confirmed deletion of all orders");

    const deletedCounts: Record<string, number> = {};
    const errors: Record<string, string> = {};

    // Helper function to delete from a table
    async function deleteFromTable(tableName: string): Promise<number> {
      try {
        // Count before (using admin client to bypass RLS)
        const { count: beforeCount, error: countError } = await supabaseAdmin
          .from(tableName)
          .select("*", { count: "exact", head: true });

        if (countError) {
          console.error(`Error counting ${tableName}:`, countError);
          errors[tableName] = countError.message;
          return 0;
        }

        const recordsToDelete = beforeCount || 0;
        
        if (recordsToDelete === 0) {
          console.log(`${tableName}: No records to delete`);
          return 0;
        }

        // Delete using universal filter (using admin client to bypass RLS)
        const { error: deleteError } = await supabaseAdmin
          .from(tableName)
          .delete()
          .not("id", "is", null);

        if (deleteError) {
          console.error(`Error deleting from ${tableName}:`, deleteError);
          errors[tableName] = deleteError.message;
          return 0;
        }

        // Count after (using admin client to bypass RLS)
        const { count: afterCount } = await supabaseAdmin
          .from(tableName)
          .select("*", { count: "exact", head: true });

        const deleted = recordsToDelete - (afterCount || 0);
        console.log(`${tableName}: Deleted ${deleted} records`);
        return deleted;
      } catch (error) {
        console.error(`Exception deleting from ${tableName}:`, error);
        errors[tableName] = error instanceof Error ? error.message : String(error);
        return 0;
      }
    }

    // Delete in order (respecting foreign key constraints)
    console.log("Starting deletion sequence...");

    deletedCounts.order_status_history = await deleteFromTable("order_status_history");
    deletedCounts.shipping_audit_logs = await deleteFromTable("shipping_audit_logs");
    deletedCounts.amazon_tracking_api_calls = await deleteFromTable("amazon_tracking_api_calls");
    deletedCounts.order_refunds = await deleteFromTable("order_refunds");
    deletedCounts.order_profits = await deleteFromTable("order_profits");
    deletedCounts.commissions = await deleteFromTable("commissions");
    deletedCounts.order_lines = await deleteFromTable("order_lines");
    deletedCounts.orders = await deleteFromTable("orders");

    const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);
    const executionTimeSeconds = (Date.now() - startTime) / 1000;

    console.log(`Deletion complete. Total deleted: ${totalDeleted} records in ${executionTimeSeconds}s`);

    // Prepare response data
    const responseData = {
      success: true,
      deleted_counts: deletedCounts,
      total_deleted: totalDeleted,
      execution_time_seconds: executionTimeSeconds,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    };

    // Log to audit_logs (using admin client to bypass RLS) - non-blocking
    try {
      await supabaseAdmin.from("audit_logs").insert({
        action_type: "delete_all_orders",
        entity_type: "orders",
        entity_id: null,
        user_id: user.id,
        user_email: user.email,
        user_role: "admin",
        details: {
          deleted_counts: deletedCounts,
          total_deleted: totalDeleted,
          execution_time_seconds: executionTimeSeconds,
          errors: Object.keys(errors).length > 0 ? errors : undefined,
        },
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
        user_agent: req.headers.get("user-agent"),
      });
    } catch (auditError) {
      console.error("Failed to log audit entry (non-fatal):", auditError);
    }

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Fatal error in delete-all-orders:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
