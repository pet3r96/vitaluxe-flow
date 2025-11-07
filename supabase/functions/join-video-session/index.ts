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

    // Fetch session details
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user authorization
    const isProvider = session.provider_id === user.id;
    const isPatient = session.patient_id === user.id;
    
    if (!isProvider && !isPatient) {
      return new Response(JSON.stringify({ error: 'Not authorized for this session' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check session status
    if (!['waiting', 'active'].includes(session.status)) {
      return new Response(JSON.stringify({ 
        error: `Session is ${session.status}. Cannot join at this time.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update participant join timestamp
    const updateFields: any = {};
    if (isProvider) {
      updateFields.provider_joined_at = new Date().toISOString();
      // Provider joining makes session active
      if (session.status === 'waiting') {
        updateFields.status = 'active';
      }
    } else {
      updateFields.patient_joined_at = new Date().toISOString();
    }

    const { data: updatedSession, error: updateError } = await supabase
      .from('video_sessions')
      .update(updateFields)
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log join event
    await supabase.from('video_session_logs').insert({
      session_id: sessionId,
      event_type: 'join',
      user_id: user.id,
      user_type: isProvider ? 'provider' : 'patient',
      event_data: { 
        joined_at: new Date().toISOString(),
        new_status: updateFields.status || session.status
      }
    });

    // Generate Agora token for this user
    const { data: tokenData, error: tokenError } = await supabase.functions.invoke('generate-agora-token', {
      body: {
        sessionId,
        role: 'publisher' // Both provider and patient can publish
      },
      headers: {
        Authorization: authHeader
      }
    });

    if (tokenError) {
      throw new Error('Failed to generate token');
    }

    return new Response(JSON.stringify({
      success: true,
      session: updatedSession,
      token: tokenData.token,
      channelName: tokenData.channelName,
      uid: tokenData.uid,
      appId: tokenData.appId,
      rtmToken: tokenData.rtmToken,
      rtmUid: tokenData.rtmUid
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error joining video session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
