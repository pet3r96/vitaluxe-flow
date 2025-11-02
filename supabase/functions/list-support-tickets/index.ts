import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Fetching support tickets for user:', user.id);

    // Fetch all patient messages with sender_type = 'patient'
    const { data: tickets, error: ticketsError } = await supabase
      .from('patient_messages')
      .select('id, subject, message_body, created_at, resolved, thread_id, patient_id, sender_type')
      .eq('sender_type', 'patient')
      .order('created_at', { ascending: false });

    if (ticketsError) {
      console.error('Error fetching support tickets:', ticketsError);
      throw ticketsError;
    }

    console.log(`Found ${tickets?.length || 0} support tickets`);

    return new Response(
      JSON.stringify({ tickets: tickets || [] }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in list-support-tickets:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        tickets: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
