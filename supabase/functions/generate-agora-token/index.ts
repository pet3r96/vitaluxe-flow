/**
 * ⚠️ DEPRECATED ENDPOINT - PERMANENTLY REMOVED
 * 
 * This endpoint has been permanently deprecated and replaced with agora-token.
 * 
 * Migration Guide:
 * 1. Change endpoint path:
 *    OLD: supabase.functions.invoke('generate-agora-token', ...)
 *    NEW: supabase.functions.invoke('agora-token', ...)
 * 
 * 2. Request body remains the same:
 *    { channel, uid, role }
 * 
 * 3. Response format is compatible:
 *    { rtcToken, rtmToken, expiresAt, channel, uid, role }
 * 
 * Documentation: https://docs.vitaluxe.app/video/agora-tokens
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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

  // Return 410 GONE with migration instructions
  return new Response(
    JSON.stringify({
      error: "ENDPOINT_DEPRECATED",
      message: "This endpoint has been permanently removed and is no longer available.",
      migration: {
        old_endpoint: "/functions/v1/generate-agora-token",
        new_endpoint: "/functions/v1/agora-token",
        changes: [
          "Update endpoint path: 'generate-agora-token' → 'agora-token'",
          "Request body format remains identical: { channel, uid, role }",
          "Response format is fully compatible",
          "All authentication and authorization works the same way"
        ],
        example: {
          before: "supabase.functions.invoke('generate-agora-token', { body: { channel, uid, role } })",
          after: "supabase.functions.invoke('agora-token', { body: { channel, uid, role } })"
        }
      },
      documentation: "https://docs.vitaluxe.app/video/agora-tokens",
      deprecated_since: "2025-11-21",
      removal_date: "2025-11-21"
    }),
    { 
      status: 410, // 410 GONE - Explicitly signals permanent removal
      headers: corsHeaders 
    }
  );
});
