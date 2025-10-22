import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationEmailRequest {
  userId: string;
  email: string;
  name: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, name }: VerificationEmailRequest = await req.json();

    if (!userId || !email || !name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, email, name' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Initialize Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate unique verification token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token in database
    const { error: tokenError } = await supabaseAdmin
      .from('email_verification_tokens')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error('Error storing verification token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to create verification token' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get OAuth email credentials
    const oauthClientId = Deno.env.get('OAUTH_EMAIL_CLIENT_ID');
    const oauthClientSecret = Deno.env.get('OAUTH_EMAIL_CLIENT_SECRET');
    const oauthRefreshToken = Deno.env.get('OAUTH_EMAIL_REFRESH_TOKEN');
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'info@vitaluxeservices.com';

    if (!oauthClientId || !oauthClientSecret || !oauthRefreshToken) {
      return new Response(
        JSON.stringify({ error: 'OAuth email credentials not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Create verification URL
    const verificationUrl = `${Deno.env.get('SUPABASE_URL')?.replace('/v1', '')}/verify-email?token=${token}`;

    // TODO: Implement OAuth email sending with token refresh
    // For now, log the email details
    console.log('OAuth email would send verification to:', email);
    console.log('Verification URL:', verificationUrl);

    // Placeholder success response - implement actual OAuth email sending
    console.log('Verification email would be sent successfully:', { email, userId });

    return new Response(
      JSON.stringify({ success: true, message: 'Verification email sent (OAuth pending implementation)' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('Error in send-verification-email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
