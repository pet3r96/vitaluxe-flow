import { createAgoraTokens } from "../_shared/agoraTokenService.ts";
import { createAuthClient } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract and verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated client and get user
    const supabase = createAuthClient(authHeader);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { channel, uid, role, ttl } = await req.json();

    // Validate required parameters
    if (!channel || channel.trim() === '') {
      console.error('Missing channel parameter');
      return new Response(
        JSON.stringify({ error: 'Bad Request - channel parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use provided values or defaults
    const finalUid = uid || user.id;
    const finalRole = role || 'publisher';
    const finalTtl = ttl || 3600;

    // Generate Agora tokens using shared service
    const { rtcToken, rtmToken, expiresAt } = await createAgoraTokens(
      channel,
      finalUid,
      finalRole,
      finalTtl
    );

    // Get App ID from environment
    const appId = Deno.env.get('AGORA_APP_ID');

    // Log successful token generation (no sensitive data)
    console.log('Agora tokens generated successfully', {
      channel,
      uid: finalUid,
      role: finalRole,
      expiresIn: finalTtl
    });

    // Return response in exact format expected by frontend
    return new Response(
      JSON.stringify({
        success: true,
        appId,
        rtcToken,
        rtmToken,
        uid: finalUid,
        expiresAt
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in agora-token function:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error - Token generation failed',
        message: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
