import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  name: string;
  temporaryPassword: string;
  role: string;
  isPasswordReset?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, temporaryPassword, role, isPasswordReset }: WelcomeEmailRequest = await req.json();

    console.log(`Sending ${isPasswordReset ? 'password reset' : 'welcome'} email to ${email} (${role})`);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured - email not sent (development mode)");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Email skipped - RESEND_API_KEY not configured" 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailSubject = isPasswordReset 
      ? "Your Password Has Been Reset - Vitaluxe Services CRM"
      : "Welcome to Vitaluxe Services CRM";

    const emailHeading = isPasswordReset
      ? "Password Reset Successful"
      : `Welcome, ${name}!`;

    const emailIntro = isPasswordReset
      ? `Your password has been successfully reset. Below are your new login credentials. Please note that you <strong>must change this temporary password</strong> upon your next login for security and HIPAA compliance.`
      : `Thank you for joining <strong>Vitaluxe Services CRM</strong>. Your account has been created with the role: <strong>${role}</strong>.`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Vitaluxe Services <onboarding@resend.dev>",
        to: [email],
        subject: emailSubject,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .logo { color: white; font-size: 28px; font-weight: bold; margin: 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .credential-box { background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; }
                .credential-label { font-weight: bold; color: #667eea; font-size: 14px; text-transform: uppercase; margin-bottom: 5px; }
                .credential-value { font-size: 18px; font-family: 'Courier New', monospace; color: #333; background: #f3f4f6; padding: 10px; border-radius: 4px; margin-bottom: 15px; }
                .warning-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
                .requirements { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .requirements ul { margin: 10px 0; padding-left: 20px; }
                .requirements li { margin: 5px 0; }
                .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 class="logo">Vitaluxe Services</h1>
                  <p style="color: white; margin: 10px 0 0 0;">Professional CRM Platform</p>
                </div>
                
              <div class="content">
                <h2 style="color: #667eea; margin-top: 0;">${emailHeading}</h2>
                
                <p>${emailIntro}</p>
                  
                  <div class="credential-box">
                    <div class="credential-label">Username / Email</div>
                    <div class="credential-value">${email}</div>
                    
                    <div class="credential-label">Temporary Password</div>
                    <div class="credential-value">${temporaryPassword}</div>
                  </div>
                  
                  <div class="warning-box">
                    <strong>⚠️ IMPORTANT SECURITY NOTICE</strong>
                    <p style="margin: 10px 0 0 0;">You <strong>must change your password</strong> upon first login. This is required for HIPAA compliance and account security.</p>
                  </div>
                  
                  <div class="requirements">
                    <h3 style="color: #667eea; margin-top: 0;">Password Requirements</h3>
                    <p>Your new password must meet these HIPAA-compliant requirements:</p>
                    <ul>
                      <li>✓ Minimum 12 characters</li>
                      <li>✓ At least 1 uppercase letter (A-Z)</li>
                      <li>✓ At least 1 lowercase letter (a-z)</li>
                      <li>✓ At least 1 number (0-9)</li>
                      <li>✓ At least 1 special character (!@#$%^&*)</li>
                      <li>✓ Cannot contain your email address</li>
                      <li>✓ Must be different from temporary password</li>
                    </ul>
                  </div>
                  
                  <p style="margin-top: 30px;">If you have any questions or need assistance, please contact our support team.</p>
                  
                  <p style="margin-top: 20px;">Best regards,<br><strong>The Vitaluxe Services Team</strong></p>
                </div>
                
                <div class="footer">
                  <p>This email contains sensitive information. Please do not share your credentials with anyone.</p>
                  <p>&copy; ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      console.error("Resend API error:", error);
      throw new Error(`Failed to send email: ${error}`);
    }

    const data = await emailResponse.json();
    console.log("Welcome email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
