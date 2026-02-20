import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyEmailRequest {
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token }: VerifyEmailRequest = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Verification token is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Initialize Supabase client
    const supabaseAdmin = createAdminClient();

    // Look up the token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('email_verification_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      edgeLogger.error('Token lookup error', tokenError);
      return new Response(
        JSON.stringify({ error: 'Invalid verification token' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if token is already used
    if (tokenData.used_at) {
      return new Response(
        JSON.stringify({ error: 'This verification link has already been used' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'This verification link has expired. Please request a new one.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Update profile to mark as verified
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        status: 'active',
        verified_at: new Date().toISOString(),
      })
      .eq('id', tokenData.user_id);

    if (profileError) {
      edgeLogger.error('Profile update error', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify account. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Confirm email in the auth system - check result!
    const { error: authConfirmError } = await supabaseAdmin.auth.admin.updateUserById(tokenData.user_id, {
      email_confirm: true,
    });

    if (authConfirmError) {
      edgeLogger.error('Auth email confirm error', authConfirmError);
      return new Response(
        JSON.stringify({ error: 'Failed to confirm email in auth system. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Mark token as used
    const { error: tokenUpdateError } = await supabaseAdmin
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id);

    if (tokenUpdateError) {
      edgeLogger.error('Token update error', tokenUpdateError);
      // Don't fail the request - the account is already verified
    }

    // Log audit event
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: tokenData.user_id,
        action_type: 'email_verified',
        entity_type: 'auth',
        details: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (auditError) {
      edgeLogger.error('Audit log error', auditError);
      // Don't fail the request
    }

    edgeLogger.info('Email verified successfully', { userId: tokenData.user_id });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email verified successfully! You can now log in.',
        userId: tokenData.user_id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    edgeLogger.error('Error in verify-email', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
