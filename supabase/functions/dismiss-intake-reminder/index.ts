import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { edgeLogger } from "../_shared/logger.ts";
import { RateLimiter, getClientIP } from "../_shared/rateLimiter.ts";
import { validateRequestSize } from "../_shared/requestSizeValidator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  userId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // PHASE 3 SECURITY: Request size validation
  const sizeValidation = validateRequestSize(req, 'dismiss-intake-reminder', corsHeaders);
  if (sizeValidation) return sizeValidation;

  try {
    // Create Supabase client
    const supabaseClient = createAdminClient();

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify the user's session
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      edgeLogger.error('[dismiss-intake-reminder] Auth error', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 3 SECURITY: Rate limiting (20 requests/hour)
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabaseClient,
      getClientIP(req),
      'dismiss-intake-reminder',
      { maxRequests: 20, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { function: 'dismiss-intake-reminder', userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { userId } = body;

    // Validate that the authenticated user matches the userId
    if (user.id !== userId) {
      edgeLogger.error('[dismiss-intake-reminder] User ID mismatch', { 
        authenticatedUserId: user.id, 
        requestedUserId: userId 
      });
      return new Response(
        JSON.stringify({ error: 'Forbidden: Cannot dismiss reminder for another user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('[dismiss-intake-reminder] Dismissing intake reminder', { userId });

    // Verify user is a patient
    const { data: patientAccount, error: patientError } = await supabaseClient
      .from('patient_accounts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (patientError) {
      edgeLogger.error('[dismiss-intake-reminder] Error checking patient account', patientError);
      throw patientError;
    }

    if (!patientAccount) {
      return new Response(
        JSON.stringify({ error: 'Not a patient account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the intake_reminder_dismissed_at field
    const { error: updateError } = await supabaseClient
      .from('patient_accounts')
      .update({ 
        intake_reminder_dismissed_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      edgeLogger.error('[dismiss-intake-reminder] Error updating patient account', updateError);
      throw updateError;
    }

    edgeLogger.info('[dismiss-intake-reminder] Successfully dismissed intake reminder', { userId });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Intake reminder dismissed successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    edgeLogger.error('[dismiss-intake-reminder] Error', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
