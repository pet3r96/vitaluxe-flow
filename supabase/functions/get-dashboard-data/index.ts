import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Batched Dashboard Data Endpoint
 * 
 * Fetches all dashboard widget data in a single request to reduce network overhead.
 * Returns aggregated data for:
 * - Unread messages count
 * - Waiting room patients
 * - Follow-up reminders
 * - Internal chat messages
 * - Today's appointments
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;

    // Fetch user profile to get role and practice
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, practice_id')
      .eq('id', userId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { role, practice_id } = profile;
    const dashboardData: Record<string, any> = {};

    // Parallel batch queries for maximum efficiency
    const promises: Promise<void>[] = [];

    // 1. Unread messages count
    promises.push(
      (async () => {
        const { data: participantThreads } = await supabase
          .from('thread_participants')
          .select('thread_id')
          .eq('user_id', userId);

        const threadIds = participantThreads?.map(pt => pt.thread_id) || [];
        if (threadIds.length > 0) {
          const { data: threads } = await supabase
            .from('message_threads')
            .select('id, messages!inner(created_at, sender_id)')
            .in('id', threadIds);

          const unreadCount = threads?.filter((thread: any) => {
            const messages = Array.isArray(thread.messages) ? thread.messages : [thread.messages];
            return messages[0]?.sender_id !== userId;
          }).length || 0;

          dashboardData.unreadMessages = unreadCount;
        } else {
          dashboardData.unreadMessages = 0;
        }
      })()
    );

    // 2. Waiting room count (for providers/doctors)
    if (['doctor', 'provider'].includes(role) && practice_id) {
      promises.push(
        (async () => {
          const { count } = await supabase
            .from('patient_appointments')
            .select('*', { count: 'exact', head: true })
            .eq('practice_id', practice_id)
            .eq('status', 'waiting_room');
          dashboardData.waitingRoomCount = count || 0;
        })()
      );
    }

    // 3. Follow-up reminders (for providers/doctors)
    if (['doctor', 'provider'].includes(role)) {
      promises.push(
        (async () => {
          const today = new Date().toISOString().split('T')[0];
          const { count } = await supabase
            .from('patient_follow_ups')
            .select('*', { count: 'exact', head: true })
            .eq('completed', false)
            .lte('follow_up_date', today);
          dashboardData.followUpsDue = count || 0;
        })()
      );
    }

    // 4. Internal chat unread count
    if (practice_id) {
      promises.push(
        (async () => {
          const { count } = await supabase
            .from('internal_messages')
            .select('*', { count: 'exact', head: true })
            .eq('practice_id', practice_id)
            .eq('completed', false);
          dashboardData.internalChatUnread = count || 0;
        })()
      );
    }

    // 5. Today's appointments count (for providers/doctors)
    if (['doctor', 'provider'].includes(role) && practice_id) {
      promises.push(
        (async () => {
          const today = new Date().toISOString().split('T')[0];
          const { count } = await supabase
            .from('patient_appointments')
            .select('*', { count: 'exact', head: true })
            .eq('practice_id', practice_id)
            .gte('appointment_date', today)
            .lte('appointment_date', today + 'T23:59:59');
          dashboardData.todayAppointments = count || 0;
        })()
      );
    }

    // Wait for all queries to complete
    await Promise.all(promises);

    console.log('[Dashboard Data] Batched response for user:', userId, dashboardData);

    return new Response(
      JSON.stringify({ success: true, data: dashboardData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Dashboard Data] Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
