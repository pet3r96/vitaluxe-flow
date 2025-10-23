import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TempPasswordEmailRequest {
  email: string;
  name: string;
  temporaryPassword?: string; // Optional - will be generated if userId provided
  role: string;
  userId?: string; // Optional - for resending welcome emails
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

    const { email, name, temporaryPassword: providedPassword, role, userId }: TempPasswordEmailRequest = await req.json();

    // Validate required fields
    if (!email || !name || !role) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: email, name, role" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate password server-side if userId is provided (resend scenario)
    let temporaryPassword = providedPassword;
    if (userId) {
      // Generate secure password
      const generateSecurePassword = (length: number = 16) => {
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let password = "";
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
          password += charset[array[i] % charset.length];
        }
        return password;
      };

      temporaryPassword = generateSecurePassword(16);

      // Update password using service role key
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: temporaryPassword }
      );

      if (passwordError) {
        console.error("Failed to update password:", passwordError);
        throw new Error(`Failed to update password: ${passwordError.message}`);
      }
    }

    // Ensure we have a password to send
    if (!temporaryPassword) {
      return new Response(
        JSON.stringify({ error: "No password provided or generated" }),
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

    // Send email via Postmark - using plain HTML instead of template
    const postmarkResponse = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": POSTMARK_API_KEY,
      },
      body: JSON.stringify({
        From: "noreply@vitaluxeservices.com",
        To: email,
        Subject: "Welcome to Vitaluxe - Your Temporary Password",
        HtmlBody: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
              .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
              .password-box { background-color: #fff; border: 2px solid #4F46E5; padding: 15px; margin: 20px 0; text-align: center; font-size: 18px; font-weight: bold; letter-spacing: 2px; }
              .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to Vitaluxe</h1>
              </div>
              <div class="content">
                <h2>Hello ${name},</h2>
                <p>Your account has been created as a <strong>${role}</strong>.</p>
                <p>Here is your temporary password:</p>
                <div class="password-box">${temporaryPassword}</div>
                <p><strong>Important:</strong> For security reasons, please change this password after your first login.</p>
                <a href="https://vitaluxeservices.com/auth" class="button">Login Now</a>
                <p>If you have any questions, please contact your administrator.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.</p>
                <p>Email: ${email}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        TextBody: `Welcome to Vitaluxe, ${name}!\n\nYour account has been created as a ${role}.\n\nTemporary Password: ${temporaryPassword}\n\nPlease login at: https://vitaluxeservices.com/auth\n\nFor security reasons, please change this password after your first login.\n\nIf you have any questions, please contact your administrator.`
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
