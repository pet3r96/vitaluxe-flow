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
    const authToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authToken);
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

    // Generate secure token for direct password change (token-based flow)
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiration

    // Store token in database (for token-based password change)
    let tokenStored = false;
    if (userId) {
      const { error: tokenError } = await supabaseAdmin
        .from('temp_password_tokens')
        .insert({
          user_id: userId,
          token: token,
          expires_at: expiresAt.toISOString()
        });

      if (tokenError) {
        console.error('Failed to create temp password token:', tokenError);
        // Don't fail the entire request, just log it
      } else {
        tokenStored = true;
        console.log('Temp password token created successfully');
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
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #E2C977; background-color: #0B0B0B; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; }
              .header { background-color: #292929; padding: 30px 20px; text-align: center; }
              .header h1 { margin: 0; color: #0B0B0B; font-size: 28px; font-weight: bold; letter-spacing: 2px; }
              .content { background-color: #1A1A1A; padding: 40px 30px; border: 1px solid #292929; }
              .content h2 { color: #E2C977; margin-top: 0; }
              .content p { color: #E2C977; }
              .password-box { background-color: #0B0B0B; border: 2px solid #C8A64B; padding: 20px; margin: 25px 0; text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 3px; color: #E2C977; border-radius: 8px; }
              .button { display: inline-block; background-color: #C8A64B; color: #0B0B0B; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 25px 0; font-weight: bold; transition: background-color 0.3s; }
              .button:hover { background-color: #E2C977; }
              .footer { text-align: center; padding: 25px 20px; color: #8E6E1E; font-size: 12px; background-color: #0B0B0B; }
              strong { color: #C8A64B; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <img src="https://app.vitaluxeservices.com/vitaluxe-logo-dark-bg.png" alt="Vitaluxe" style="max-width: 200px; height: auto;" />
              </div>
              <div class="content">
                <h2>Welcome, ${name}</h2>
                <p>Your account has been created as a <strong>${role}</strong>.</p>
                <p>Your temporary password is:</p>
                <div class="password-box">${temporaryPassword}</div>
                <p><strong>Recommended:</strong> Click the button below to set your own password immediately (no login required):</p>
                <a href="https://app.vitaluxeservices.com/change-password?token=${token}" class="button">Set Your Password</a>
                <p><strong>Alternative:</strong> You can also log in using the temporary password above and change it in your profile.</p>
                <p style="color: #8E6E1E; font-size: 13px;"><em>This link expires in 24 hours.</em></p>
                <p>If you have any questions, please contact your administrator.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.</p>
                <p>${email}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        TextBody: `Welcome to Vitaluxe, ${name}!\n\nYour account has been created as a ${role}.\n\nTemporary Password: ${temporaryPassword}\n\nRECOMMENDED: Set your password directly (no login required):\nhttps://app.vitaluxeservices.com/change-password?token=${token}\n\nALTERNATIVE: Log in with the temporary password above and change it in your profile:\nhttps://app.vitaluxeservices.com/change-password?email=${encodeURIComponent(email)}\n\nThis link expires in 24 hours.\n\nFor security reasons, you must change this password before using your account.\n\nIf you have any questions, please contact your administrator.`
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
