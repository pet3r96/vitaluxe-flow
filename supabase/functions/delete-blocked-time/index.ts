import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { deleteBlockedTimeSchema, validateInput } from '../_shared/zodSchemas.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate input with Zod schema
    const body = await req.json();
    const validation = validateInput(deleteBlockedTimeSchema, body);
    
    if (!validation.success) {
      throw new Error(`Invalid input: ${validation.errors.join(', ')}`);
    }

    const { blockedTimeId } = validation.data;

    // RLS will handle permissions
    const { error } = await supabaseClient
      .from('practice_blocked_time')
      .delete()
      .eq('id', blockedTimeId);

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error deleting blocked time:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
