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
import { createAuthClient, createAdminClient } from "../_shared/supabaseAdmin.ts";
import { edgeLogger } from "../_shared/logger.ts";

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

  const startTime = Date.now();
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  try {
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
    const supabaseAdmin = createAdminClient();
    
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
      edgeLogger.logOperation({
        user_id: user.id,
        ip_address: ipAddress,
        operation: 'generate_agora_token',
        success: false,
        duration_ms: Date.now() - startTime,
        metadata: { reason: 'invalid_role', role: profile.role }
      });
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
      role = 'publisher'
    } = body;
    
    // PHASE 2 WEEK 4: Enforce 30-minute expiry for security
    const expireSeconds = 1800; // Hard-coded to 30 minutes (1800 seconds)

    // Validate required fields
    if (!channel || typeof channel !== 'string' || channel.trim() === '') {
      edgeLogger.logOperation({
        user_id: user.id,
        ip_address: ipAddress,
        operation: 'generate_agora_token',
        success: false,
        duration_ms: Date.now() - startTime,
        metadata: { reason: 'invalid_channel' }
      });
      return new Response(
        JSON.stringify({ 
          error: 'Invalid channel',
          hint: 'channel is required and must be a non-empty string'
        }), 
        { status: 400, headers: corsHeaders }
      );
    }

    // PHASE 2 PART 8: Channel-level authorization validation
    const channelParts = channel.split('_');
    const channelType = channelParts[0]; // 'instant', 'session', 'practice-room'

    if (channelType === 'session') {
      // Validate video_sessions access
      const { data: session } = await supabaseAdmin
        .from('video_sessions')
        .select('channel_name, provider_id, patient_id, practice_id')
        .eq('channel_name', channel)
        .maybeSingle();
      
      if (!session) {
        edgeLogger.warn('Invalid channel: session not found', { userId: user.id, channel });
        edgeLogger.logOperation({
          user_id: user.id,
          ip_address: ipAddress,
          operation: 'generate_agora_token',
          success: false,
          duration_ms: Date.now() - startTime,
          metadata: { reason: 'session_not_found', channel }
        });
        return new Response(
          JSON.stringify({ error: 'Invalid channel: session not found' }),
          { status: 404, headers: corsHeaders }
        );
      }
      
      // Check if user is authorized (provider, patient, admin, or practice member)
      const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
      const isProvider = session.provider_id === user.id;
      const isPatient = session.patient_id === user.id;
      
      // Check if user is in the practice
      const { data: practiceProvider } = await supabaseAdmin
        .from('providers')
        .select('id')
        .eq('user_id', user.id)
        .eq('practice_id', session.practice_id)
        .maybeSingle();
      
      const { data: practiceStaff } = await supabaseAdmin
        .from('practice_staff')
        .select('id')
        .eq('user_id', user.id)
        .eq('practice_id', session.practice_id)
        .maybeSingle();
      
      const isInPractice = !!practiceProvider || !!practiceStaff || user.id === session.practice_id;
      
      if (!isAdmin && !isProvider && !isPatient && !isInPractice) {
        edgeLogger.warn('Unauthorized channel access attempt', {
          userId: user.id,
          channel,
          sessionPracticeId: session.practice_id
        });
        
        // PHASE 2: Log cross-tenant access attempt
        await supabaseAdmin.from('audit_logs').insert({
          action_type: 'cross_tenant_access_attempt',
          user_id: user.id,
          entity_type: 'video_session',
          entity_id: session.practice_id,
          ip_address: ipAddress,
          details: { 
            channel, 
            reason: 'unauthorized_practice_access',
            session_practice_id: session.practice_id,
            timestamp: new Date().toISOString()
          }
        });
        
        edgeLogger.logOperation({
          user_id: user.id,
          ip_address: ipAddress,
          operation: 'generate_agora_token',
          success: false,
          duration_ms: Date.now() - startTime,
          metadata: { reason: 'unauthorized_channel_access', channel }
        });
        
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Cannot access this video channel' }),
          { status: 403, headers: corsHeaders }
        );
      }
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
