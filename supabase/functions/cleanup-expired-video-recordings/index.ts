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

    // Find sessions with expired recordings
    const { data: expiredSessions, error: fetchError } = await supabase
      .from('video_sessions')
      .select('id, recording_url, recording_expires_at')
      .not('recording_url', 'is', null)
      .lt('recording_expires_at', new Date().toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!expiredSessions || expiredSessions.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No expired recordings found',
        count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${expiredSessions.length} expired recordings to clean up`);

    // Update sessions to remove recording URLs
    const sessionIds = expiredSessions.map(s => s.id);
    
    const { error: updateError } = await supabase
      .from('video_sessions')
      .update({
        recording_url: null,
        metadata: { 
          recording_expired: true,
          expired_at: new Date().toISOString()
        }
      })
      .in('id', sessionIds);

    if (updateError) {
      throw updateError;
    }

    // Log cleanup events
    const logEntries = expiredSessions.map(session => ({
      session_id: session.id,
      event_type: 'recording_cleanup',
      user_type: 'system',
      event_data: {
        expired_at: session.recording_expires_at,
        cleaned_at: new Date().toISOString()
      }
    }));

    await supabase.from('video_session_logs').insert(logEntries);

    return new Response(JSON.stringify({
      success: true,
      message: `Cleaned up ${expiredSessions.length} expired recordings`,
      count: expiredSessions.length,
      sessionIds
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error cleaning up expired recordings:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
