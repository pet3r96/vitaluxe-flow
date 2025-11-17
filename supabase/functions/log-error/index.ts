import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateLogErrorRequest } from "../_shared/requestValidators.ts";
import { edgeLogger } from "../_shared/logger.ts";

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
      edgeLogger.error('Invalid JSON in request body', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = validateLogErrorRequest(requestData);
    if (!validation.valid) {
      edgeLogger.warn('Validation failed', { errors: validation.errors });
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

    // Admin client (service role) to bypass RLS for inserts
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
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

    // Insert error log into audit_logs table (bypass RLS with service role)
    const { error: insertError } = await adminClient.from("audit_logs").insert({
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
      edgeLogger.error("Failed to insert error log", insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    edgeLogger.error("Error in log-error function", error);
    
    // Properly serialize error - handle all types
    let errorDetails;
    if (error instanceof Error) {
      errorDetails = { message: error.message, name: error.name, stack: error.stack };
    } else if (typeof error === 'object' && error !== null) {
      try {
        errorDetails = { message: JSON.stringify(error, Object.getOwnPropertyNames(error)) };
      } catch {
        errorDetails = { message: 'Unable to serialize error object' };
      }
    } else {
      errorDetails = { message: String(error) };
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: {
          code: 'LOGGING_ERROR',
          message: 'Failed to log application error',
          details: errorDetails
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
