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

    // Fetch session
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

    if (!session.recording_resource_id || !session.recording_sid) {
      return new Response(JSON.stringify({ error: 'No active recording found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const customerId = Deno.env.get('AGORA_CUSTOMER_ID');
    const customerSecret = Deno.env.get('AGORA_CUSTOMER_SECRET');
    const rawAppId = Deno.env.get('AGORA_APP_ID');

    if (!customerId || !customerSecret || !rawAppId) {
      console.error('Missing Agora Cloud Recording credentials');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const appId = rawAppId.trim();
    if (!/^[a-f0-9]{32}$/i.test(appId)) {
      console.error('Invalid Agora App ID format for recording stop', {
        appIdSample: appId.substring(0, 6) + '...'
      });
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const basicAuth = btoa(`${customerId}:${customerSecret}`);
    const baseUrl = 'https://api.agora.io/v1/apps';

    // Stop recording
    const stopResponse = await fetch(
      `${baseUrl}/${appId}/cloud_recording/resourceid/${session.recording_resource_id}/sid/${session.recording_sid}/mode/mix/stop`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cname: session.channel_name,
          uid: '999999',
          clientRequest: {}
        })
      }
    );

    if (!stopResponse.ok) {
      throw new Error(`Stop recording failed: ${await stopResponse.text()}`);
    }

    const stopData = await stopResponse.json();

    // Query for recording files
    const queryResponse = await fetch(
      `${baseUrl}/${appId}/cloud_recording/resourceid/${session.recording_resource_id}/sid/${session.recording_sid}/mode/mix/query`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let recordingUrl = null;
    if (queryResponse.ok) {
      const queryData = await queryResponse.json();
      // Extract recording file URL from response
      if (queryData.serverResponse?.fileList?.length > 0) {
        const fileName = queryData.serverResponse.fileList[0].fileName;
        const bucket = Deno.env.get('AGORA_RECORDING_BUCKET') || 'vitaluxepro-recordings';
        const region = Deno.env.get('AWS_REGION') || 'us-east-1';
        recordingUrl = `https://${bucket}.s3.${region}.amazonaws.com/recordings/${session.channel_name}/${fileName}`;
      }
    }

    // Calculate expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Update session with recording stop info
    await supabase
      .from('video_sessions')
      .update({
        recording_stopped_at: new Date().toISOString(),
        recording_url: recordingUrl,
        recording_expires_at: expiresAt.toISOString()
      })
      .eq('id', sessionId);

    // Log recording stop
    await supabase.from('video_session_logs').insert({
      session_id: sessionId,
      event_type: 'recording_stop',
      user_id: user.id,
      user_type: 'system',
      event_data: { 
        recordingUrl,
        stopData 
      }
    });

    return new Response(JSON.stringify({
      success: true,
      recordingUrl,
      expiresAt: expiresAt.toISOString(),
      message: 'Recording stopped successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error stopping video recording:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
