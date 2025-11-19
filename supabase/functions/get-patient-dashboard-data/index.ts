import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, createAuthClient } from "../_shared/supabaseAdmin.ts";
import { cacheFetch } from "../_shared/cache.ts";
import { isAdmin as checkIsAdmin } from '../_shared/roleChecker.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateRequestSize } from '../_shared/requestSizeValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // PHASE 3 SECURITY: Request size validation
  const sizeValidation = validateRequestSize(req, 'get-patient-dashboard-data', corsHeaders);
  if (sizeValidation) return sizeValidation;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Use auth client to authenticate requesting user
    const supabaseAuth = createAuthClient(authHeader);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // PHASE 3 SECURITY: Rate limiting (30 requests/hour)
    const supabase = createAdminClient();
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabase,
      getClientIP(req),
      'get-patient-dashboard-data',
      { maxRequests: 30, windowSeconds: 3600 }
    );

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { effectiveUserId } = await req.json();
    if (!effectiveUserId) {
      throw new Error('effectiveUserId is required');
    }

    // Check if user is admin or accessing their own data
    const isAdmin = await checkIsAdmin(supabaseAuth, user.id);
    
    // Allow if admin (for impersonation) or if accessing own data
    if (!isAdmin && user.id !== effectiveUserId) {
      throw new Error('Unauthorized: Cannot access other user data');
    }

    // Cache key uses only patient_id, NOT PHI like name/email
    const cacheKey = `patient_dashboard:${effectiveUserId}`;
    
    const dashboardData = await cacheFetch(
      cacheKey,
      async () => {
        console.log('Cache miss - fetching patient dashboard data');
        
        // Get patient account
        const { data: patientAccount, error: accountError } = await supabase
          .from('patient_accounts')
          .select('*')
          .eq('user_id', effectiveUserId)
          .single();

        if (accountError || !patientAccount) {
          throw new Error('Patient account not found');
        }

        // Get appointments count
        const { count: appointmentsCount, error: appointmentsError } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('patient_id', patientAccount.id);

        if (appointmentsError) throw appointmentsError;

        // Get upcoming appointments count
        const { count: upcomingAppointmentsCount, error: upcomingError } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('patient_id', patientAccount.id)
          .gte('appointment_date', new Date().toISOString())
          .eq('status', 'scheduled');

        if (upcomingError) throw upcomingError;

        // Get orders count
        const { data: orderLines, error: ordersError } = await supabase
          .from('order_lines')
          .select('id', { count: 'exact' })
          .eq('patient_id', patientAccount.id);

        if (ordersError) throw ordersError;

        // Get recent appointments for activity
        const { data: recentAppointments, error: recentApptError } = await supabase
          .from('appointments')
          .select('id, appointment_date, status, appointment_type')
          .eq('patient_id', patientAccount.id)
          .order('appointment_date', { ascending: false })
          .limit(5);

        if (recentApptError) throw recentApptError;

        // Get recent orders for activity
        const { data: recentOrders, error: recentOrdersError } = await supabase
          .from('order_lines')
          .select('id, created_at, status, product_id')
          .eq('patient_id', patientAccount.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentOrdersError) throw recentOrdersError;

        // Get recent messages
        const { data: recentMessages, error: messagesError } = await supabase
          .from('message_threads')
          .select(`
            id,
            subject,
            created_at,
            resolved,
            messages!inner(body, created_at)
          `)
          .eq('created_by', effectiveUserId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (messagesError) throw messagesError;

        // Format activity items
        const recentActivity = [
          ...(recentAppointments || []).map(apt => ({
            id: apt.id,
            type: 'appointment' as const,
            title: `${apt.appointment_type || 'Appointment'}`,
            timestamp: apt.appointment_date,
            status: apt.status
          })),
          ...(recentOrders || []).map(order => ({
            id: order.id,
            type: 'order' as const,
            title: 'Order',
            timestamp: order.created_at,
            status: order.status
          })),
          ...(recentMessages || []).map(msg => ({
            id: msg.id,
            type: 'message' as const,
            title: msg.subject,
            timestamp: msg.created_at,
            status: msg.resolved ? 'resolved' : 'active'
          }))
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10);

        return {
          appointmentsCount: appointmentsCount || 0,
          upcomingAppointmentsCount: upcomingAppointmentsCount || 0,
          ordersCount: orderLines?.length || 0,
          recentActivity
        };
      },
      120 // 120 seconds TTL
    );

    return new Response(
      JSON.stringify(dashboardData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-patient-dashboard-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
