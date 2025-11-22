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

    // ========== SESSION ACCESS VALIDATION ==========
    // Validate user has legitimate access to this video session
    const { data: sessionRecord, error: sessionErr } = await supabase
      .from('video_sessions')
      .select('patient_id, provider_id, practice_id')
      .eq('channel_name', channel)
      .single();

    if (!sessionRecord || sessionErr) {
      console.error('Session not found:', sessionErr);
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Check if user is the patient
    const { data: patientMatch } = await supabase
      .from('patient_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('id', sessionRecord.patient_id)
      .maybeSingle();

    // Check if user is a provider in the practice
    const { data: providerMatch } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', user.id)
      .eq('practice_id', sessionRecord.practice_id)
      .maybeSingle();

    // Deny access if user is not authorized
    if (!patientMatch && !providerMatch && profile?.role !== 'admin') {
      console.error('Access denied:', { userId: user.id, sessionId: sessionRecord });
      return new Response(
        JSON.stringify({ error: 'Access denied - Not authorized for this session' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Session access validated:', { userId: user.id, channel });
    // ========== END VALIDATION ==========

    // ========== UPDATE SESSION STATUS TO LIVE ==========
    // Transition scheduled sessions to live when someone joins
    await supabase
      .from('video_sessions')
      .update({ 
        status: 'live', 
        actual_start_time: new Date().toISOString() 
      })
      .eq('channel_name', channel)
      .eq('status', 'scheduled');
    
    console.log('Session status updated to live if scheduled');
    // ========== END STATUS UPDATE ==========

    // Use authenticated user ID as UID (consistent with create-video-session)
    const finalUid = user.id;
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

    console.log("BACKEND CHECK", {
      appId: Deno.env.get("AGORA_APP_ID"),
      cert: Deno.env.get("AGORA_APP_CERTIFICATE")
    });

    // DIAGNOSTIC: Log App ID details for debugging
    console.log('🔍 App ID Diagnostic:', {
      appId,
      appIdDefined: appId !== undefined,
      appIdLength: appId?.length || 0,
      appIdFirstChars: appId?.substring(0, 4) || 'N/A',
      appIdLastChars: appId?.substring(appId.length - 4) || 'N/A',
      appIdTrimmed: appId?.trim() === appId,
      appIdFormat: /^[a-f0-9]{32}$/.test(appId || '') ? 'valid' : 'invalid'
    });

    // Validate App ID before returning
    if (!appId || appId.trim() === '') {
      console.error('CRITICAL: AGORA_APP_ID is missing or empty from backend secrets');
      return new Response(
        JSON.stringify({ 
          error: 'Backend configuration error - AGORA_APP_ID not set',
          details: 'The Agora App ID secret is not configured in backend'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get App Certificate from environment
    const appCert = Deno.env.get('AGORA_APP_CERTIFICATE');

    // DIAGNOSTIC: Log App Certificate details for debugging
    console.log('🔍 App Certificate Diagnostic:', {
      certDefined: appCert !== undefined,
      certLength: appCert?.length || 0,
      certFirstChars: appCert?.substring(0, 4) || 'N/A',
      certLastChars: appCert?.substring(appCert.length - 4) || 'N/A',
      certTrimmed: appCert?.trim() === appCert
    });

    // Validate App Certificate before returning
    if (!appCert || appCert.trim() === '') {
      console.error('CRITICAL: AGORA_APP_CERTIFICATE is missing or empty from backend secrets');
      return new Response(
        JSON.stringify({ 
          error: 'Backend configuration error - AGORA_APP_CERTIFICATE not set',
          details: 'The Agora App Certificate secret is not configured in backend. It must match the certificate from the same Agora project as the App ID.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful token generation (no sensitive data)
    console.log('Agora tokens generated successfully', {
      channel,
      uid: finalUid,
      role: finalRole,
      expiresIn: finalTtl,
      appIdValid: true
    });

    // Return response in exact format expected by frontend
    return new Response(
      JSON.stringify({
        success: true,
        appId,
        rtcToken,
        rtmToken,
        uid: finalUid,
        rtmUid: finalUid,
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
