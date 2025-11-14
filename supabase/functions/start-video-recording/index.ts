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

    // Verify session is active
    if (session.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Session must be active to start recording' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if recording already started
    if (session.recording_started_at) {
      return new Response(JSON.stringify({ 
        error: 'Recording already started',
        resourceId: session.recording_resource_id,
        sid: session.recording_sid
      }), {
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
      console.error('Invalid Agora App ID format for recording', {
        appIdSample: appId.substring(0, 6) + '...'
      });
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const basicAuth = btoa(`${customerId}:${customerSecret}`);
    const baseUrl = 'https://api.agora.io/v1/apps';

    // Step 1: Acquire resource
    const acquireResponse = await fetch(`${baseUrl}/${appId}/cloud_recording/acquire`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cname: session.channel_name,
        uid: '999999', // Recording bot UID
        clientRequest: {
          resourceExpiredHour: 24,
          scene: 0 // Real-time recording
        }
      })
    });

    if (!acquireResponse.ok) {
      throw new Error(`Acquire failed: ${await acquireResponse.text()}`);
    }

    const acquireData = await acquireResponse.json();
    const resourceId = acquireData.resourceId;

    // Step 2: Start recording
    const startResponse = await fetch(
      `${baseUrl}/${appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cname: session.channel_name,
          uid: '999999',
          clientRequest: {
            recordingConfig: {
              channelType: 1, // Live broadcast
              streamTypes: 2, // Audio and video
              maxIdleTime: 30,
              transcodingConfig: {
                width: 1280,
                height: 720,
                fps: 30,
                bitrate: 2000,
                mixedVideoLayout: 1 // Best fit
              }
            },
            storageConfig: {
              vendor: 2, // AWS S3
              region: 0, // us-east-1
              bucket: Deno.env.get('AGORA_RECORDING_BUCKET') || 'vitaluxepro-recordings',
              accessKey: Deno.env.get('AWS_ACCESS_KEY_ID'),
              secretKey: Deno.env.get('AWS_SECRET_ACCESS_KEY'),
              fileNamePrefix: ['recordings', session.channel_name]
            }
          }
        })
      }
    );

    if (!startResponse.ok) {
      throw new Error(`Start recording failed: ${await startResponse.text()}`);
    }

    const startData = await startResponse.json();
    const sid = startData.sid;

    // Update session with recording info
    await supabase
      .from('video_sessions')
      .update({
        recording_started_at: new Date().toISOString(),
        recording_resource_id: resourceId,
        recording_sid: sid
      })
      .eq('id', sessionId);

    // Log recording start
    await supabase.from('video_session_logs').insert({
      session_id: sessionId,
      event_type: 'recording_start',
      user_id: user.id,
      user_type: 'system',
      event_data: { resourceId, sid }
    });

    return new Response(JSON.stringify({
      success: true,
      resourceId,
      sid,
      message: 'Recording started successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error starting video recording:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
