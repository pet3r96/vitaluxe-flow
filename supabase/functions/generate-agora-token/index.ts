/**
 * ⚠️ DEPRECATED: This endpoint is deprecated and will be removed soon.
 * Please use /functions/v1/agora-token instead.
 * 
 * Migration Guide:
 * - Change endpoint: 'generate-agora-token' → 'agora-token'
 * - Change parameter: 'expireSeconds' → 'ttl'
 * - Response format remains compatible
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAgoraTokens, type AgoraRole } from "../_shared/agoraTokenService.ts";
import { createAuthClient } from "../_shared/supabaseAdmin.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        error: 'Method not allowed',
        hint: 'Use POST to generate tokens'
      }), 
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const { edgeLogger } = await import('../_shared/logger.ts');
    
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      edgeLogger.error('[generate-agora-token] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', hint: 'Missing Authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabase = createAuthClient(authHeader);
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      edgeLogger.error('[generate-agora-token] Authentication failed', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', hint: 'Invalid or expired token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Get user role from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      edgeLogger.error('[generate-agora-token] Failed to fetch user profile', profileError);
      return new Response(
        JSON.stringify({ error: 'Forbidden', hint: 'User profile not found' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Only allow specific roles to generate tokens
    const allowedRoles = ['provider', 'admin', 'staff', 'practice', 'patient'];
    if (!allowedRoles.includes(profile.role)) {
      edgeLogger.error('[generate-agora-token] Invalid role', { role: profile.role, userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Forbidden', hint: 'Insufficient permissions to generate video tokens' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Log deprecation warning
    edgeLogger.warn('DEPRECATED endpoint called', { endpoint: '/generate-agora-token', migrateendpoint: '/agora-token', userId: user.id });
    
    // Parse request body
    const body = await req.json();
    const { 
      channel, 
      uid = `user_${user.id}`,
      role = 'publisher',
      expireSeconds = 3600 
    } = body;

    // Validate required fields
    if (!channel || typeof channel !== 'string' || channel.trim() === '') {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid channel',
          hint: 'channel is required and must be a non-empty string'
        }), 
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate role
    if (role !== 'publisher' && role !== 'subscriber') {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid role',
          hint: 'role must be either "publisher" or "subscriber"'
        }), 
        { status: 400, headers: corsHeaders }
      );
    }

    // TODO: Validate channel access based on user's appointments/sessions
    // For now, we allow authenticated users to generate tokens for any channel
    // In production, you should verify the user has permission to join the specific channel

    // Generate tokens using shared service
    edgeLogger.info('[generate-agora-token] Token request', {
      channel,
      uid,
      role,
      expireSeconds,
      userId: user.id,
      userRole: profile.role
    });

    const tokens = await createAgoraTokens(
      channel,
      uid,
      role as AgoraRole,
      expireSeconds
    );

    // Return success response
    return new Response(
      JSON.stringify({
        rtcToken: tokens.rtcToken,
        rtmToken: tokens.rtmToken,
        expiresAt: tokens.expiresAt,
        channel,
        uid,
        role
      }),
      { 
        status: 200,
        headers: corsHeaders 
      }
    );

  } catch (error) {
    const { edgeLogger } = await import('../_shared/logger.ts');
    edgeLogger.error('[generate-agora-token] Error', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate tokens',
        hint: errorMessage
      }), 
      { 
        status: 400,
        headers: corsHeaders 
      }
    );
  }
});
