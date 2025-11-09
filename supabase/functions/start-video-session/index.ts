import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch session first
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('[start-video-session] Session not found:', sessionError?.message);
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch provider to check authorization
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('user_id, practice_id')
      .eq('id', session.provider_id)
      .single();

    // Fetch provider profile for display name (optional)
    const { data: providerProfile } = await supabase
      .from('profiles')
      .select('full_name, name')
      .eq('id', provider?.user_id)
      .maybeSingle();

    const providerName = providerProfile?.full_name || providerProfile?.name || 'Provider';

    if (providerError || !provider) {
      console.error('[start-video-session] Provider not found:', providerError?.message);
      return new Response(JSON.stringify({ error: 'Provider not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is an admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    
    const isAdmin = userRole?.role === 'admin';

    // Determine effective user (handle impersonation)
    let effectiveUserId = user.id;
    try {
      const { data: imp } = await supabase
        .from('active_impersonation_sessions')
        .select('impersonated_user_id, revoked, expires_at')
        .eq('admin_user_id', user.id)
        .eq('revoked', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (imp?.impersonated_user_id) {
        effectiveUserId = imp.impersonated_user_id;
      }
    } catch (_) {}

    // Authorization: admin, assigned provider, or provider/staff in same practice
    let authorized = isAdmin || provider.user_id === effectiveUserId;
    
    if (!authorized) {
      // Check if user is ANY personnel (provider/staff) in the same practice
      const { data: myProviderOrStaff } = await supabase
        .from('providers')
        .select('practice_id, role_type')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      
      authorized = myProviderOrStaff?.practice_id === session.practice_id;
    }

    if (!authorized) {
      console.error('[start-video-session] Authorization failed:', { provider_user_id: provider.user_id, auth_user_id: user.id, effectiveUserId });
      return new Response(JSON.stringify({ error: 'Not authorized to start this session' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('patient_appointments')
      .select('id, visit_type, practice_id')
      .eq('id', session.appointment_id)
      .single();

    if (appointmentError || !appointment) {
      console.error('[start-video-session] Appointment not found:', appointmentError?.message);
      return new Response(JSON.stringify({ error: 'Appointment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch patient profile
    const { data: patientProfile, error: profileError } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', session.patient_id)
      .maybeSingle();

    if (profileError) {
      console.error('[start-video-session] Patient profile not found:', profileError?.message);
    }

    // Verify appointment is video type
    if (appointment.visit_type !== 'video') {
      return new Response(JSON.stringify({ error: 'Appointment is not a video consultation' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update session status to 'waiting'
    const { data: updatedSession, error: updateError } = await supabase
      .from('video_sessions')
      .update({
        status: 'waiting',
        actual_start_time: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log session start
    await supabase.from('video_session_logs').insert({
      session_id: sessionId,
      event_type: 'session_started',
      user_id: user.id,
      user_type: 'provider',
      event_data: { status: 'waiting' }
    });

    // Send SMS to patient only if they haven't joined yet and phone is available
    const patientPhone = patientProfile?.phone;
    const patientAlreadyJoined = session.patient_joined_at !== null;
    
    if (patientAlreadyJoined) {
      console.log('ℹ️ Patient already joined - skipping SMS notification');
    }

    if (patientPhone && !patientAlreadyJoined) {
      const providerDisplayName = providerName;
      
      // Build URLs using origin header or environment variable
      const origin = req.headers.get('origin') || 
                     req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 
                     Deno.env.get('SITE_URL') || 
                     'https://vitaluxeservices-app.lovable.app';
      
      const portalUrl = `${origin}/patient/video/${sessionId}`;
      
      // Generate guest link (best-effort, non-blocking)
      let guestLinkUrl = '';
      try {
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const { error: linkError } = await supabase
          .from('video_session_guest_links')
          .insert({
            session_id: sessionId,
            token,
            expires_at: expiresAt.toISOString(),
            created_by: user.id,
            max_uses: 999, // Allow reconnections
          });

        if (!linkError) {
          guestLinkUrl = `${origin}/video-guest/${token}`;
          console.log('✅ Guest link created:', guestLinkUrl);
          
          // Log guest link generation
          await supabase.from('video_session_logs').insert({
            session_id: sessionId,
            event_type: 'guest_link_auto_generated',
            user_id: user.id,
            user_type: 'provider',
            event_data: { token_id: token, expires_at: expiresAt.toISOString() }
          });
        }
      } catch (linkGenError) {
        console.warn('⚠️ Failed to generate guest link:', linkGenError);
      }

      // Fetch practice name for template
      const { data: practiceProfile } = await supabase
        .from('profiles')
        .select('full_name, name, practice_name')
        .eq('id', session.practice_id)
        .maybeSingle();

      const practiceName = practiceProfile?.practice_name || practiceProfile?.full_name || practiceProfile?.name || 'VitaLuxe Healthcare';

      // Fetch patient name for template
      const { data: patientAccount } = await supabase
        .from('patient_accounts')
        .select('first_name, last_name')
        .eq('id', session.patient_id)
        .maybeSingle();

      const patientName = patientAccount 
        ? `${patientAccount.first_name || ''} ${patientAccount.last_name || ''}`.trim() || 'there'
        : 'there';
      
      // Send SMS (best-effort, non-blocking)
      try {
        // Fetch custom SMS template or use default
        const { data: templateData } = await supabase
          .from('practice_sms_templates')
          .select('message_template')
          .eq('practice_id', session.practice_id)
          .eq('template_type', 'session_ready')
          .eq('is_active', true)
          .maybeSingle();

        let smsMessage = templateData?.message_template;

        // Fallback to default template if none found
        if (!smsMessage) {
          if (guestLinkUrl) {
            smsMessage = `Your video appointment with {{provider_name}} is ready!\n\nPortal Login: {{portal_link}}\nGuest Access: {{guest_link}}\n\nGuest link expires in 24 hours.\n\n{{practice_name}}`;
          } else {
            smsMessage = `Your video appointment with {{provider_name}} is ready!\n\nJoin now: {{portal_link}}\n\n{{practice_name}}`;
          }
        }

        // Replace tokens with actual values
        smsMessage = smsMessage
          .replace(/\{\{provider_name\}\}/g, providerDisplayName)
          .replace(/\{\{patient_name\}\}/g, patientName)
          .replace(/\{\{portal_link\}\}/g, portalUrl)
          .replace(/\{\{guest_link\}\}/g, guestLinkUrl)
          .replace(/\{\{practice_name\}\}/g, practiceName);

        await supabase.functions.invoke('send-ghl-sms', {
          body: {
            to: patientPhone,
            message: smsMessage
          }
        });
        console.log('✅ SMS sent to patient');
      } catch (smsError) {
        console.warn('⚠️ Failed to send SMS:', smsError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      session: updatedSession,
      message: 'Video session started. Patient has been notified.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error starting video session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
