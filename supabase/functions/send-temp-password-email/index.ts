import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TempPasswordEmailRequest {
  email: string;
  name: string;
  temporaryPassword: string;
  role: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin role
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roles) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, name, temporaryPassword, role }: TempPasswordEmailRequest = await req.json();

    // Validate required fields
    if (!email || !name || !temporaryPassword || !role) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: email, name, temporaryPassword, role" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const POSTMARK_API_KEY = Deno.env.get("POSTMARK_API_KEY");
    if (!POSTMARK_API_KEY) {
      console.error("POSTMARK_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    // Send email via Postmark
    const postmarkResponse = await fetch("https://api.postmarkapp.com/email/withTemplate", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": POSTMARK_API_KEY,
      },
      body: JSON.stringify({
        From: "noreply@vitaluxeservices.com",
        To: email,
        TemplateAlias: "temp-password-email",
        TemplateModel: {
          name: name,
          email: email,
          temporary_password: temporaryPassword,
          role: role,
          login_link: "https://vitaluxeservices.com/auth"
        },
      }),
    });

    if (!postmarkResponse.ok) {
      const errorText = await postmarkResponse.text();
      console.error("Postmark API error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const result = await postmarkResponse.json();
    console.log("Temporary password email sent successfully:", result.MessageID);

    // Log audit event
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
      (await supabaseAdmin.from('profiles').select('id').eq('email', email).single()).data?.id ?? ''
    );

    if (authUser?.user) {
      await supabaseAdmin.rpc('log_audit_event', {
        p_action_type: 'temp_password_email_sent',
        p_entity_type: 'user',
        p_entity_id: authUser.user.id,
        p_details: { role, email }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Temporary password email sent successfully",
        messageId: result.MessageID 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-temp-password-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to send temporary password email" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
