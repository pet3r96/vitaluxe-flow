import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CredentialAccessRequest {
  profile_id: string;
  profile_name: string;
  accessed_fields: {
    npi?: boolean;
    dea?: boolean;
    license?: boolean;
  };
  viewer_role: string;
  relationship: string;
  component_context: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CredentialAccessRequest = await req.json();

    console.log(`Logging credential access: ${user.email} viewed ${body.profile_name}'s credentials`);

    // Build field summary
    const fields = [];
    if (body.accessed_fields.npi) fields.push('NPI');
    if (body.accessed_fields.dea) fields.push('DEA');
    if (body.accessed_fields.license) fields.push('License');

    // Log to audit_logs table using the existing function
    await supabase.rpc('log_audit_event', {
      p_action_type: 'credential_access',
      p_entity_type: 'profiles',
      p_entity_id: body.profile_id,
      p_details: {
        profile_name: body.profile_name,
        accessed_fields: fields.join(', '),
        viewer_role: body.viewer_role,
        relationship: body.relationship,
        component: body.component_context,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error logging credential access:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Internal server error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
