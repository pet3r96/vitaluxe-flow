import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateLogErrorRequest } from "../_shared/requestValidators.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse JSON with error handling
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      console.error('Invalid JSON in request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = validateLogErrorRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data', 
          details: validation.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Extract validated data
    const { action_type, entity_type, details } = requestData;

    // Get user info if authenticated
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    // Get user role if user exists
    let userRole = null;
    if (user) {
      const { data: roleData } = await supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      
      userRole = roleData?.role;
    }

    // Insert error log into audit_logs table
    const { error: insertError } = await supabaseClient.from("audit_logs").insert({
      action_type,
      entity_type,
      entity_id: details.entity_id || null,
      details,
      user_id: user?.id || null,
      user_email: user?.email || null,
      user_role: userRole,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      user_agent: req.headers.get("user-agent"),
    });

    if (insertError) {
      console.error("Failed to insert error log:", insertError);
      throw insertError;
    }
    
    // Notify all admins of critical errors
    if (action_type === 'error' || details.severity === 'error') {
      try {
        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        
        const { data: adminRoles } = await adminClient
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');
        
        if (adminRoles && adminRoles.length > 0) {
          const adminNotifications = adminRoles.map(role => ({
            user_id: role.user_id,
            title: 'System Error Detected',
            message: `${details.error_message || 'An error occurred in the system'}`,
            notification_type: 'system_error',
            severity: 'error',
            entity_type: 'audit_logs',
            entity_id: details.entity_id,
            action_url: '/admin/logs',
            metadata: {
              error_type: entity_type,
              user_email: user?.email,
              stack_trace: details.stack_trace
            },
            read: false,
          }));
          
          await adminClient.from('notifications').insert(adminNotifications);
          console.log(`[log-error] Sent error notification to ${adminRoles.length} admins`);
        }
      } catch (notifError) {
        console.error('[log-error] Failed to send admin notifications:', notifError);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in log-error function:", error);
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
