/**
 * ⚠️ DEPRECATED: This endpoint is deprecated and will be removed soon.
 * Please use /functions/v1/agora-token instead.
 * 
 * Migration Guide:
 * - Change endpoint: 'generate-agora-token' → 'agora-token'
 * - Change parameter: 'expireSeconds' → 'ttl'
 * - Response format remains compatible
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAgoraTokens, type AgoraRole } from "../_shared/agoraTokenService.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// TODO: lock down with Supabase auth (verify_jwt = true in config.toml)

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
    // Log deprecation warning
    console.warn('⚠️ DEPRECATED: /generate-agora-token called. Please migrate to /agora-token');
    
    // Parse request body
    const body = await req.json();
    const { 
      channel, 
      uid = `user_${Math.random().toString(36).substring(2, 15)}`,
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

    // Generate tokens using shared service
    console.log('[generate-agora-token] Token request:', {
      channel,
      uid,
      role,
      expireSeconds
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
    console.error('[generate-agora-token] Error:', error);
    
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
