import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Unified Dashboard Data Endpoint - Amazon Fast Performance
 * 
 * Single endpoint that batches ALL dashboard data in parallel:
 * - Basic stats (orders, products, revenue, users)
 * - Today's appointments (top 5)
 * - Waiting room patients (top 5)
 * - Follow-up reminders (top 5)
 * - Unread messages count
 * - Internal chat unread count
 * 
 * Performance target: <1s total execution time
 */
Deno.serve(async (req) => {
  const startTime = performance.now();
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401);
    }

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData?.user) {
      return errorResponse('Unauthorized', 401);
    }

    const userId = userData.user.id;

    // Fetch user profile to get role and practice
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, practice_id')
      .eq('id', userId)
      .single();

    if (!profile) {
      return errorResponse('Profile not found', 404);
    }

    const { role, practice_id } = profile;
    const result: Record<string, any> = {
      role,
      practice_id,
    };

    // Execute ALL queries in parallel for maximum speed
    const [
      ordersData,
      productsData,
      pendingOrdersData,
      usersData,
      revenueData,
      appointmentsData,
      waitingRoomData,
      followUpsData,
      unreadMessagesData,
      internalChatData,
    ] = await Promise.all([
      // 1. Total orders count
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .then(({ count }) => count || 0),

      // 2. Products count
      supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .then(({ count }) => count || 0),

      // 3. Pending orders count
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then(({ count }) => count || 0),

      // 4. Users count (for admin)
      role === 'admin'
        ? supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .then(({ count }) => count || 0)
        : Promise.resolve(0),

      // 5. Revenue data
      supabase
        .from('orders')
        .select('total, status')
        .in('status', ['pending', 'paid'])
        .then(({ data }) => {
          const pending = data?.filter(o => o.status === 'pending').reduce((sum, o) => sum + (o.total || 0), 0) || 0;
          const collected = data?.filter(o => o.status === 'paid').reduce((sum, o) => sum + (o.total || 0), 0) || 0;
          return { pendingRevenue: pending, collectedRevenue: collected };
        }),

      // 6. Today's appointments (top 5)
      ['doctor', 'provider', 'practice', 'staff'].includes(role) && practice_id
        ? supabase
            .from('patient_appointments')
            .select(`
              id,
              start_time,
              end_time,
              status,
              service_type,
              patient:patient_accounts!patient_appointments_patient_id_fkey(id, first_name, last_name),
              provider:providers(id, first_name, last_name)
            `)
            .eq('practice_id', practice_id)
            .gte('start_time', new Date().toISOString().split('T')[0])
            .lt('start_time', new Date(Date.now() + 86400000).toISOString().split('T')[0])
            .order('start_time', { ascending: true })
            .limit(5)
            .then(({ data }) => data || [])
        : Promise.resolve([]),

      // 7. Waiting room patients (top 5)
      ['doctor', 'provider', 'practice', 'staff'].includes(role) && practice_id
        ? supabase
            .from('patient_appointments')
            .select(`
              id,
              checked_in_at,
              patient:patient_accounts!patient_appointments_patient_id_fkey(id, first_name, last_name)
            `)
            .eq('practice_id', practice_id)
            .eq('status', 'checked_in')
            .order('checked_in_at', { ascending: true })
            .limit(5)
            .then(({ data }) => data || [])
        : Promise.resolve([]),

      // 8. Follow-up reminders (top 5)
      ['doctor', 'provider'].includes(role)
        ? supabase
            .from('patient_follow_ups')
            .select(`
              id,
              follow_up_date,
              reason,
              patient:patient_accounts!patient_follow_ups_patient_id_fkey(id, first_name, last_name)
            `)
            .eq('status', 'pending')
            .lte('follow_up_date', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
            .order('follow_up_date', { ascending: true })
            .limit(5)
            .then(({ data }) => data || [])
        : Promise.resolve([]),

      // 9. Unread messages count
      (async () => {
        const { data: participantThreads } = await supabase
          .from('thread_participants')
          .select('thread_id')
          .eq('user_id', userId);

        const threadIds = participantThreads?.map(pt => pt.thread_id) || [];
        if (threadIds.length === 0) return 0;

        const { data: threads } = await supabase
          .from('message_threads')
          .select('id, messages!inner(created_at, sender_id)')
          .in('id', threadIds);

        return threads?.filter((thread: any) => {
          const messages = Array.isArray(thread.messages) ? thread.messages : [thread.messages];
          return messages[0]?.sender_id !== userId;
        }).length || 0;
      })(),

      // 10. Internal chat unread count
      practice_id
        ? supabase
            .from('internal_message_recipients')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', userId)
            .is('read_at', null)
            .then(({ count }) => count || 0)
        : Promise.resolve(0),
    ]);

    // Assemble response
    result.ordersCount = ordersData;
    result.productsCount = productsData;
    result.pendingOrdersCount = pendingOrdersData;
    result.usersCount = usersData;
    result.pendingRevenue = revenueData.pendingRevenue;
    result.collectedRevenue = revenueData.collectedRevenue;
    result.todayAppointments = appointmentsData;
    result.waitingRoomPatients = waitingRoomData;
    result.followUpReminders = followUpsData;
    result.unreadMessages = unreadMessagesData;
    result.internalChatUnread = internalChatData;

    const executionTime = performance.now() - startTime;
    console.log(`[Unified Dashboard] Execution time: ${executionTime.toFixed(2)}ms`);

    return successResponse(result);
  } catch (error) {
    console.error('[Unified Dashboard] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(errorMessage, 500);
  }
});
