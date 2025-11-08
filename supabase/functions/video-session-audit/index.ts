import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

// This is a PUBLIC diagnostic function for auditing video sessions
// It checks channel names for Agora compatibility without requiring authentication

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Agora channel name requirements:
// - Max 64 characters
// - Allowed: a-z, A-Z, 0-9, underscore (_), hyphen (-)
const AGORA_CHANNEL_PATTERN = /^[A-Za-z0-9_\-]+$/;
const AGORA_MAX_LENGTH = 64;

function validateChannelName(channelName: string) {
  const lengthValid = channelName.length <= AGORA_MAX_LENGTH;
  const charactersValid = AGORA_CHANNEL_PATTERN.test(channelName);
  
  return {
    channelName,
    length: channelName.length,
    lengthValid,
    lengthCheck: lengthValid ? '✅' : `❌ (exceeds ${AGORA_MAX_LENGTH})`,
    charactersValid,
    charactersCheck: charactersValid ? '✅' : '❌ (invalid characters)',
    agoraSafe: lengthValid && charactersValid,
    issues: [
      ...(!lengthValid ? [`Length ${channelName.length} exceeds max ${AGORA_MAX_LENGTH}`] : []),
      ...(!charactersValid ? ['Contains invalid characters (only a-z, A-Z, 0-9, _, - allowed)'] : [])
    ]
  };
}

Deno.serve(async (req) => {
  console.log('🔍 [video-session-audit] Request received');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Parse request body for limit parameter
    let limit = 10;
    try {
      const body = await req.json();
      if (body.limit && typeof body.limit === 'number') {
        limit = Math.min(body.limit, 100); // Cap at 100
      }
    } catch {
      // No body or invalid JSON, use default
    }

    console.log(`📊 Auditing last ${limit} video sessions...`);

    // Fetch recent video sessions
    const { data: sessions, error: queryError } = await supabase
      .from('video_sessions')
      .select('id, appointment_id, channel_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (queryError) {
      console.error('❌ Query error:', queryError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to query video sessions',
        details: queryError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No video sessions found',
        count: 0,
        sessions: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate each session's channel name
    const audits = sessions.map(session => {
      const validation = validateChannelName(session.channel_name);
      return {
        sessionId: session.id,
        appointmentId: session.appointment_id,
        status: session.status,
        createdAt: session.created_at,
        ...validation
      };
    });

    const allSafe = audits.every(a => a.agoraSafe);
    const issues = audits.filter(a => !a.agoraSafe);

    console.log(`✅ Audit complete: ${audits.length} sessions, ${issues.length} issues`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        totalSessions: audits.length,
        agoraSafeCount: audits.filter(a => a.agoraSafe).length,
        issuesCount: issues.length,
        allAgoraSafe: allSafe
      },
      agoraRequirements: {
        maxLength: AGORA_MAX_LENGTH,
        allowedCharacters: 'a-z, A-Z, 0-9, underscore (_), hyphen (-)',
        pattern: AGORA_CHANNEL_PATTERN.toString()
      },
      sessions: audits,
      issues: issues.length > 0 ? issues : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [video-session-audit] Error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
