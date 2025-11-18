import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, createAuthClient } from "../_shared/supabaseAdmin.ts";
import { cacheFetch } from "../_shared/cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { effectiveUserId } = await req.json();
    if (!effectiveUserId) {
      throw new Error('effectiveUserId is required');
    }

    // Check if user is admin or accessing their own data
    const { data: userRoles } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const isAdmin = userRoles?.some(r => r.role === 'admin' || r.role === 'super_admin');
    
    // Allow if admin (for impersonation) or if accessing own data
    if (!isAdmin && user.id !== effectiveUserId) {
      throw new Error('Unauthorized: Cannot access other user data');
    }

    // Use admin client for actual queries to bypass RLS
    const supabase = createAdminClient();

    const cacheKey = `pharmacy_dashboard:${effectiveUserId}`;
    
    const dashboardData = await cacheFetch(
      cacheKey,
      async () => {
        console.log('Cache miss - fetching pharmacy dashboard stats');
        
        // Get pharmacy record
        const { data: pharmacy, error: pharmacyError } = await supabase
          .from('pharmacies')
          .select('id')
          .eq('user_id', effectiveUserId)
          .single();

        if (pharmacyError || !pharmacy) {
          throw new Error('Pharmacy not found');
        }

        // Get orders count
        const { count: ordersCount, error: ordersError } = await supabase
          .from('order_lines')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_pharmacy_id', pharmacy.id);

        if (ordersError) throw ordersError;

        // Get pending orders count
        const { count: pendingOrdersCount, error: pendingError } = await supabase
          .from('order_lines')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_pharmacy_id', pharmacy.id)
          .eq('status', 'pending');

        if (pendingError) throw pendingError;

        // Get products count
        const { count: productsCount, error: productsError } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true });

        if (productsError) throw productsError;

        // Get recent activity (last 10 order lines)
        const { data: recentActivity, error: activityError } = await supabase
          .from('order_lines')
          .select('id, order_id, status, created_at, patient_name')
          .eq('assigned_pharmacy_id', pharmacy.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (activityError) throw activityError;

        // Get orders by status
        const { data: ordersByStatusData, error: statusError } = await supabase
          .from('order_lines')
          .select('status')
          .eq('assigned_pharmacy_id', pharmacy.id);

        if (statusError) throw statusError;

        const ordersByStatus = (ordersByStatusData || []).reduce((acc: Record<string, number>, line: any) => {
          const status = line.status || 'unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        return {
          ordersCount: ordersCount || 0,
          pendingOrdersCount: pendingOrdersCount || 0,
          productsCount: productsCount || 0,
          recentActivity: recentActivity || [],
          ordersByStatus
        };
      },
      60 // 60 seconds TTL
    );

    return new Response(
      JSON.stringify(dashboardData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-pharmacy-dashboard-stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
