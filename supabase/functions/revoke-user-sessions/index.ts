import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

/**
 * Revoke User Sessions Edge Function
 * 
 * SECURITY: Revokes all refresh tokens and deletes all user_sessions for a user
 * Called when:
 * - Password is reset
 * - Phone number is changed
 * - Admin resets user password
 * 
 * This forces the user to re-authenticate on all devices.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RevokeSessionsRequest {
  userId: string;
  reason: 'password_reset' | 'phone_change' | 'admin_action';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Authentication required
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      edgeLogger.warn('Revoke sessions attempt without auth header');
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Parse request body
    const { userId, reason }: RevokeSessionsRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    edgeLogger.info('Revoking all sessions for user', {
      userId,
      reason,
      correlationId: crypto.randomUUID(),
    });

    // Step 1: Revoke all refresh tokens globally (Supabase Auth)
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(
      userId,
      'global'
    );

    if (signOutError) {
      edgeLogger.error('Failed to revoke refresh tokens', signOutError, { userId });
      return new Response(
        JSON.stringify({ 
          error: 'Failed to revoke refresh tokens',
          details: signOutError.message 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Step 2: Delete all user_sessions records
    const { error: deleteError } = await supabaseAdmin
      .from('user_sessions')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      edgeLogger.error('Failed to delete user_sessions', deleteError, { userId });
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete user sessions',
          details: deleteError.message 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Log success
    edgeLogger.info('Successfully revoked all sessions', {
      userId,
      reason,
      durationMs: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'All sessions revoked successfully',
        userId,
        reason,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    edgeLogger.error('Revoke sessions error', error, {
      durationMs: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
