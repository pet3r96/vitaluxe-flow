import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { RtcTokenBuilder, RtcRole, RtmTokenBuilder, RtmRole } from 'https://esm.sh/agora-access-token@2.0.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP for audit logging
    const clientIp = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Validate guest link
    const { data: guestLink, error: linkError } = await supabaseAdmin
      .from('video_session_guest_links')
      .select('*, video_sessions(*)')
      .eq('token', token)
      .single();

    if (linkError || !guestLink) {
      await supabaseAdmin.from('audit_logs').insert({
        action_type: 'video_guest_link_invalid',
        entity_type: 'video_session_guest_links',
        details: { token, ip_address: clientIp, reason: 'Token not found' },
      });

      return new Response(
        JSON.stringify({ error: 'invalid_token', message: 'Invalid or expired guest link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (new Date(guestLink.expires_at) < new Date()) {
      await supabaseAdmin.from('audit_logs').insert({
        action_type: 'video_guest_link_expired',
        entity_type: 'video_session_guest_links',
        entity_id: guestLink.id,
        details: { token, ip_address: clientIp, expires_at: guestLink.expires_at },
      });

      return new Response(
        JSON.stringify({ error: 'expired', message: 'This guest link has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if revoked
    if (guestLink.is_revoked) {
      return new Response(
        JSON.stringify({ error: 'revoked', message: 'This guest link has been revoked' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max uses
    if (guestLink.access_count >= guestLink.max_uses) {
      return new Response(
        JSON.stringify({ error: 'already_used', message: 'This guest link has already been used' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check session status
    const session = guestLink.video_sessions;
    if (!['waiting', 'active'].includes(session.status)) {
      return new Response(
        JSON.stringify({ 
          error: 'session_not_ready', 
          message: 'The video session is not available at this time' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate Agora tokens
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

    if (!appId || !appCertificate) {
      throw new Error('Agora credentials not configured');
    }

    const channelName = session.channel_name;
    const uid = Math.floor(Math.random() * 1000000);
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Generate RTC token
    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    // Generate RTM token
    const rtmUid = `guest_${uid}`;
    const rtmToken = RtmTokenBuilder.buildToken(
      appId,
      appCertificate,
      rtmUid,
      RtmRole.Rtm_User,
      privilegeExpiredTs
    );

    // Update access count and timestamps
    const updateData: any = {
      access_count: guestLink.access_count + 1,
      accessed_by_ip: clientIp,
    };

    if (!guestLink.used_at) {
      updateData.used_at = new Date().toISOString();
    }

    await supabaseAdmin
      .from('video_session_guest_links')
      .update(updateData)
      .eq('id', guestLink.id);

    // Log access event
    await supabaseAdmin.from('video_session_logs').insert({
      session_id: session.id,
      event_type: 'guest_link_accessed',
      details: {
        guest_link_id: guestLink.id,
        ip_address: clientIp,
        access_count: guestLink.access_count + 1,
      },
    });

    await supabaseAdmin.from('audit_logs').insert({
      action_type: 'video_guest_link_accessed',
      entity_type: 'video_session_guest_links',
      entity_id: guestLink.id,
      details: {
        session_id: session.id,
        ip_address: clientIp,
        access_count: guestLink.access_count + 1,
      },
    });

    // Get provider name - properly traverse the relationship
    // First get the provider record to get user_id
    const { data: provider } = await supabaseAdmin
      .from('providers')
      .select('user_id')
      .eq('id', session.provider_id)
      .maybeSingle();

    // Then get the profile using the user_id
    const { data: providerProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, name')
      .eq('id', provider?.user_id)
      .maybeSingle();

    const providerName = providerProfile?.full_name || providerProfile?.name || 'Provider';

    return new Response(
      JSON.stringify({
        success: true,
        sessionData: {
          channelName,
          token: rtcToken,
          uid,
          appId,
          rtmToken,
          rtmUid,
          sessionId: session.id,
          providerName,
          scheduledTime: session.scheduled_start_time,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in validate-video-guest-link:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});