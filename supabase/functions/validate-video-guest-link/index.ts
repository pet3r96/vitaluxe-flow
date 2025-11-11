import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { RtcTokenBuilder, RtcRole, RtmTokenBuilder } from "https://esm.sh/agora-access-token@2.0.4";

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

    // Check if revoked first
    if (guestLink.is_revoked) {
      return new Response(
        JSON.stringify({ error: 'revoked', message: 'This guest link has been revoked' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check session status - block if consultation is complete
    const session = guestLink.video_sessions;
    if (['ended', 'failed'].includes(session.status)) {
      return new Response(
        JSON.stringify({ 
          error: 'session_completed', 
          message: 'This video session has ended. Please contact your provider if you need assistance.' 
        }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Smart expiration: Check if link expired, but allow within 1 hour of appointment
    if (new Date(guestLink.expires_at) < new Date()) {
      const appointmentTime = new Date(session.scheduled_start_time);
      const oneHourAfterAppointment = new Date(appointmentTime.getTime() + 60 * 60 * 1000);
      const now = new Date();
      
      // Block if more than 1 hour past appointment time
      if (now > oneHourAfterAppointment) {
        await supabaseAdmin.from('audit_logs').insert({
          action_type: 'video_guest_link_expired',
          entity_type: 'video_session_guest_links',
          entity_id: guestLink.id,
          details: { 
            token, 
            ip_address: clientIp, 
            expires_at: guestLink.expires_at,
            appointment_time: session.scheduled_start_time,
            reason: '1 hour past appointment time'
          },
        });

        return new Response(
          JSON.stringify({ 
            error: 'expired', 
            message: 'This guest link has expired. It was valid until 1 hour after your scheduled appointment time.' 
          }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Otherwise continue - within appointment window even though expires_at passed
    }

    // Check max uses only if explicitly set low (allow reconnections for default 999)
    if (guestLink.max_uses && guestLink.max_uses < 999 && guestLink.access_count >= guestLink.max_uses) {
      return new Response(
        JSON.stringify({ error: 'max_uses_exceeded', message: 'This guest link has reached its usage limit' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Allow if session is waiting or active
    if (!['waiting', 'active'].includes(session.status)) {
      return new Response(
        JSON.stringify({ 
          error: 'session_not_ready', 
          message: 'The video session is not available at this time' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channelName = session.channel_name;
    const guestUid = `guest_${guestLink.id}`;

    // Get Agora credentials
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');
    
    if (!appId || !appCertificate) {
      throw new Error('Agora credentials not configured');
    }

    // Generate tokens using official Agora implementation
    const expire = Math.floor(Date.now() / 1000) + 3600;
    
    const rtcToken = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channelName,
      guestUid,
      RtcRole.PUBLISHER,
      expire
    );
    
    const rtmToken = RtmTokenBuilder.buildToken(
      appId,
      appCertificate,
      guestUid,
      expire
    );
    
    const tokens = {
      rtcToken,
      rtmToken,
      rtmUid: guestUid,
      expiresAt: expire,
      appId
    };

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
          token: tokens.rtcToken,
          uid: tokens.rtmUid,
          appId,
          rtmToken: tokens.rtmToken,
          rtmUid: tokens.rtmUid,
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