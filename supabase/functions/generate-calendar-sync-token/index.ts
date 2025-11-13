import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate cryptographically secure random token (32 bytes = 64 hex characters)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // Check if user already has a token
    const { data: existingToken } = await supabaseClient
      .from('calendar_sync_tokens')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existingToken) {
      // Update existing token
      const { error: updateError } = await supabaseClient
        .from('calendar_sync_tokens')
        .update({
          token,
          is_active: true,
          created_at: new Date().toISOString(),
          last_accessed_at: null,
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating token:', updateError);
        throw updateError;
      }
    } else {
      // Insert new token
      const { error: insertError } = await supabaseClient
        .from('calendar_sync_tokens')
        .insert({
          user_id: user.id,
          token,
          is_active: true,
        });

      if (insertError) {
        console.error('Error inserting token:', insertError);
        throw insertError;
      }
    }

    // Construct feed URL
    const feedUrl = `${SUPABASE_URL}/functions/v1/calendar-feed?token=${token}`;

    console.log('Calendar sync token generated for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        feedUrl,
        token,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating calendar sync token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
