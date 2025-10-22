import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { validateSendWelcomeEmailRequest } from "../_shared/requestValidators.ts";

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
    const validation = validateSendWelcomeEmailRequest(requestData);
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

    const { email, name, temporaryPassword, role, isPasswordReset }: WelcomeEmailRequest = requestData;

    console.log(`Sending ${isPasswordReset ? 'password reset' : 'welcome'} email to ${email} (${role})`);

    // Check for OAuth email credentials
    const oauthClientId = Deno.env.get('OAUTH_EMAIL_CLIENT_ID');
    const oauthClientSecret = Deno.env.get('OAUTH_EMAIL_CLIENT_SECRET');
    const oauthRefreshToken = Deno.env.get('OAUTH_EMAIL_REFRESH_TOKEN');
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@vitaluxeservice.com';
    
    if (!oauthClientId || !oauthClientSecret || !oauthRefreshToken) {
      console.log("OAuth email not configured - email not sent (development mode)");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Email skipped - OAuth email not configured" 
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

    // TODO: Implement OAuth email sending
    // For now, log the email details
    console.log('OAuth email would send to:', email);
    console.log('Subject:', emailSubject);
    console.log('Temp password:', temporaryPassword);

    // Placeholder success response
    console.log("Welcome email would be sent successfully via OAuth");

    return new Response(JSON.stringify({ success: true, message: 'Email sent (OAuth pending implementation)' }), {
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
