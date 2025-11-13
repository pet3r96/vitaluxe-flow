import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAuthClient } from '../_shared/supabaseAdmin.ts';

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

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify the user's session
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[dismiss-intake-reminder] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { userId } = body;

    // Validate that the authenticated user matches the userId
    if (user.id !== userId) {
      console.error('[dismiss-intake-reminder] User ID mismatch', { 
        authenticatedUserId: user.id, 
        requestedUserId: userId 
      });
      return new Response(
        JSON.stringify({ error: 'Forbidden: Cannot dismiss reminder for another user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[dismiss-intake-reminder] Dismissing intake reminder for user:', userId);

    // Verify user is a patient
    const { data: patientAccount, error: patientError } = await supabaseClient
      .from('patient_accounts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (patientError) {
      console.error('[dismiss-intake-reminder] Error checking patient account:', patientError);
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
      console.error('[dismiss-intake-reminder] Error updating patient account:', updateError);
      throw updateError;
    }

    console.log('[dismiss-intake-reminder] Successfully dismissed intake reminder for user:', userId);

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
    console.error('[dismiss-intake-reminder] Error:', error);
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
