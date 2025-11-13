import { createAdminClient } from '../_shared/supabaseAdmin.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  try {
    const supabase = createAdminClient();

    // Call the database function to check and create notifications
    const { error } = await supabase.rpc('notify_due_follow_ups');

    if (error) {
      console.error('Error calling notify_due_follow_ups:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully checked follow-ups and created notifications');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Follow-up notifications processed successfully',
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
