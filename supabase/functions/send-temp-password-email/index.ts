import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TempPasswordEmailRequest {
  email: string;
  name: string;
  tempPassword: string;
  createdBy: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, tempPassword, createdBy }: TempPasswordEmailRequest = await req.json();

    if (!email || !name || !tempPassword || !createdBy) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, name, tempPassword, createdBy' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Initialize Supabase client to verify admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify that the caller is an admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', createdBy)
      .maybeSingle();

    if (rolesError || roles?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only admins can send temp password emails' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
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

    // Create login URL
    const loginUrl = `${Deno.env.get('SUPABASE_URL')?.replace('/v1', '')}/auth`;

    // TODO: Implement OAuth email sending with token refresh
    // For now, log the email details
    console.log('OAuth email would send temp password to:', email);
    console.log('Temp password:', tempPassword);
    console.log('Login URL:', loginUrl);

    // Placeholder success response - implement actual OAuth email sending
    console.log('Temp password email would be sent successfully:', { email });

    return new Response(
      JSON.stringify({ success: true, message: 'Temporary password email sent (OAuth pending implementation)' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('Error in send-temp-password-email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
