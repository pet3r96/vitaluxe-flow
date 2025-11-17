// ============================================================================
// UNIFIED GUEST ACCESS VALIDATOR
// Consolidates all guest validation flows into a single endpoint
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';
import { createAgoraTokens } from '../_shared/agoraTokenService.ts';
import { getClientIP } from '../_shared/rateLimiter.ts';
import { buildRtcToken, buildRtmToken, Role } from '../_shared/agoraTokenBuilder.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, token } = await req.json();

    if (!action) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Action is required. Valid actions: validate-video-token, validate-video-link, validate-share-link' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (action) {
      case 'validate-video-token': {
        // Validates guest token and returns session details + Agora credentials
        console.log('[validate-guest-access] Validating video token:', token.substring(0, 8) + '...');

        // Lookup guest token
        const { data: guestToken, error: tokenError } = await supabase
          .from('video_guest_tokens')
          .select('*')
          .eq('token', token)
          .single();

        if (tokenError || !guestToken) {
          console.error('[validate-guest-access] Invalid token');
          return new Response(
            JSON.stringify({ success: false, error: 'invalid', message: 'Invalid guest token' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check expiration
        const now = new Date();
        const expiresAt = new Date(guestToken.expires_at);

        if (now > expiresAt) {
          console.error('[validate-guest-access] Token expired');
          return new Response(
            JSON.stringify({ success: false, error: 'expired', message: 'Guest link has expired' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get session details
        const { data: session, error: sessionError } = await supabase
          .from('video_sessions')
          .select('*')
          .eq('id', guestToken.session_id)
          .single();

        if (sessionError || !session) {
          console.error('[validate-guest-access] Session not found');
          return new Response(
            JSON.stringify({ success: false, error: 'session_ended', message: 'Video session not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if session is still active
        if (session.status === 'ended') {
          console.error('[validate-guest-access] Session already ended');
          return new Response(
            JSON.stringify({ success: false, error: 'session_ended', message: 'Video session has ended' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Mark token as used (first use only)
        if (!guestToken.used_at) {
          await supabase
            .from('video_guest_tokens')
            .update({ used_at: new Date().toISOString() })
            .eq('id', guestToken.id);
        }

        // Generate Agora tokens (PUBLISHER role for audio/video access)
        const uid = Math.floor(Math.random() * 1000000).toString();
        const tokens = await createAgoraTokens(
          session.channel_name,
          uid,
          'publisher',
          3600
        );

        // Get practice name for display
        const { data: practice } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', session.practice_id)
          .single();

        console.log('[validate-guest-access] Token validated successfully');

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              sessionId: session.id,
              channelName: session.channel_name,
              uid,
              rtcToken: tokens.rtcToken,
              rtmToken: tokens.rtmToken,
              expiresAt: tokens.expiresAt,
              practiceName: practice?.name || 'Unknown Practice',
              guestName: guestToken.guest_name
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'validate-video-link': {
        // Validates video session guest link with audit logging
        console.log('[validate-guest-access] Validating video link:', token.substring(0, 8) + '...');

        const clientIp = getClientIP(req);

        // Validate guest link
        const { data: guestLink, error: linkError } = await supabase
          .from('video_session_guest_links')
          .select('*, video_sessions(*)')
          .eq('token', token)
          .single();

        if (linkError || !guestLink) {
          await supabase.from('audit_logs').insert({
            action_type: 'video_guest_link_invalid',
            entity_type: 'video_session_guest_links',
            details: { token, ip_address: clientIp, reason: 'Token not found' },
          });

          return new Response(
            JSON.stringify({ success: false, error: 'invalid_token', message: 'Invalid or expired guest link' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if revoked first
        if (guestLink.is_revoked) {
          return new Response(
            JSON.stringify({ success: false, error: 'revoked', message: 'This guest link has been revoked' }),
            { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check session status
        const session = guestLink.video_sessions;
        if (['ended', 'failed'].includes(session.status)) {
          return new Response(
            JSON.stringify({ 
              success: false,
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
          
          if (now > oneHourAfterAppointment) {
            await supabase.from('audit_logs').insert({
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
                success: false,
                error: 'expired', 
                message: 'This guest link has expired. It was valid until 1 hour after your scheduled appointment time.' 
              }),
              { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Generate Agora tokens
        const uid = `guest_${Math.floor(Math.random() * 1000000)}`;
        const agoraTokens = await createAgoraTokens(
          session.channel_name,
          uid,
          'publisher',
          7200
        );

        // Update link usage
        const currentUseCount = guestLink.current_use_count || 0;
        await supabase
          .from('video_session_guest_links')
          .update({ 
            current_use_count: currentUseCount + 1,
            last_accessed_at: new Date().toISOString(),
            last_accessed_ip: clientIp
          })
          .eq('id', guestLink.id);

        // Get practice info
        const { data: practice } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', session.practice_id)
          .single();

        // Audit log
        await supabase.from('audit_logs').insert({
          action_type: 'video_guest_link_accessed',
          entity_type: 'video_session_guest_links',
          entity_id: guestLink.id,
          details: {
            session_id: session.id,
            guest_name: guestLink.guest_name,
            ip_address: clientIp,
            use_count: currentUseCount + 1
          }
        });

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              sessionId: session.id,
              channelName: session.channel_name,
              appointmentId: session.appointment_id,
              uid,
              rtcToken: agoraTokens.rtcToken,
              rtmToken: agoraTokens.rtmToken,
              expiresAt: agoraTokens.expiresAt,
              guestName: guestLink.guest_name,
              practiceName: practice?.name || 'Practice',
              practiceEmail: practice?.email
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'validate-share-link': {
        // Validates medical vault share link
        console.log('[validate-guest-access] Validating share link:', token.substring(0, 8) + '...');

        const clientIp = getClientIP(req);

        // Validate token and get share link data
        const { data: shareLink, error: linkError } = await supabase
          .from('medical_vault_share_links')
          .select(`
            id,
            patient_id,
            expires_at,
            used_at,
            access_count,
            is_revoked,
            patient_accounts!inner(
              id,
              first_name,
              last_name,
              date_of_birth,
              user_id
            )
          `)
          .eq('token', token)
          .single();

        if (linkError || !shareLink) {
          console.error('[validate-guest-access] Share link not found:', linkError);
          return new Response(
            JSON.stringify({ success: false, error: 'invalid_token', message: 'Invalid share link' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const currentAccessCount = shareLink.access_count || 0;

        // Check if expired
        const now = new Date();
        const expiresAt = new Date(shareLink.expires_at);
        if (now > expiresAt) {
          await supabase.from('audit_logs').insert({
            user_id: null,
            user_email: 'public',
            user_role: 'public',
            action_type: 'medical_vault_share_link_expired',
            entity_type: 'medical_vault_share_links',
            entity_id: shareLink.id,
            details: { token, ip_address: clientIp, expired_at: shareLink.expires_at }
          });

          return new Response(
            JSON.stringify({ success: false, error: 'expired', message: 'This link has expired after 60 minutes' }),
            { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if revoked
        if (shareLink.is_revoked) {
          return new Response(
            JSON.stringify({ success: false, error: 'revoked', message: 'This link has been revoked' }),
            { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch all medical data for PDF generation
        const patientAccountId = shareLink.patient_id;
        
        const [
          { data: medications },
          { data: conditions },
          { data: allergies },
          { data: vitals },
          { data: immunizations },
          { data: surgeries },
          { data: pharmacies },
          { data: emergencyContacts }
        ] = await Promise.all([
          supabase.from('patient_medical_vault').select('*').eq('patient_account_id', patientAccountId).eq('record_type', 'medication'),
          supabase.from('patient_medical_vault').select('*').eq('patient_account_id', patientAccountId).eq('record_type', 'condition'),
          supabase.from('patient_medical_vault').select('*').eq('patient_account_id', patientAccountId).eq('record_type', 'allergy'),
          supabase.from('patient_medical_vault').select('*').eq('patient_account_id', patientAccountId).eq('record_type', 'vital'),
          supabase.from('patient_medical_vault').select('*').eq('patient_account_id', patientAccountId).eq('record_type', 'immunization'),
          supabase.from('patient_medical_vault').select('*').eq('patient_account_id', patientAccountId).eq('record_type', 'surgery'),
          supabase.from('patient_medical_vault').select('*').eq('patient_account_id', patientAccountId).eq('record_type', 'pharmacy'),
          supabase.from('patient_medical_vault').select('*').eq('patient_account_id', patientAccountId).eq('record_type', 'emergency_contact')
        ]);

        // Increment access count
        const newAccessCount = currentAccessCount + 1;
        const updateData: any = { 
          access_count: newAccessCount,
          accessed_by_ip: clientIp 
        };
        
        if (newAccessCount === 1) {
          updateData.used_at = new Date().toISOString();
        }
        
        await supabase
          .from('medical_vault_share_links')
          .update(updateData)
          .eq('id', shareLink.id);

        // Extract patient account
        const patientAccount = Array.isArray(shareLink.patient_accounts) 
          ? shareLink.patient_accounts[0] 
          : shareLink.patient_accounts;

        // Audit log
        await supabase.from('audit_logs').insert({
          user_id: patientAccount?.user_id || null,
          user_email: 'external_recipient',
          user_role: 'external',
          action_type: 'medical_vault_share_accessed',
          entity_type: 'medical_vault_share_links',
          entity_id: shareLink.id,
          details: {
            patient_account_id: patientAccountId,
            ip_address: clientIp,
            access_count: newAccessCount,
            accessed_at: new Date().toISOString()
          }
        });

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              patientAccount: {
                firstName: patientAccount?.first_name,
                lastName: patientAccount?.last_name,
                dateOfBirth: patientAccount?.date_of_birth
              },
              medicalData: {
                medications: medications || [],
                conditions: conditions || [],
                allergies: allergies || [],
                vitals: vitals || [],
                immunizations: immunizations || [],
                surgeries: surgeries || [],
                pharmacies: pharmacies || [],
                emergencyContacts: emergencyContacts || []
              },
              metadata: {
                accessCount: newAccessCount,
                expiresAt: shareLink.expires_at
              }
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Unknown action: ${action}. Valid actions: validate-video-token, validate-video-link, validate-share-link` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch (error) {
    console.error('[validate-guest-access] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
