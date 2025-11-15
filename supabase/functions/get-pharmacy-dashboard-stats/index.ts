import { createAdminClient } from '../_shared/supabaseAdmin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PharmacyDashboardStats {
  ordersCount: number;
  pendingOrdersCount: number;
  productsCount: number;
  recentActivity: any[];
  ordersByStatus: Record<string, number>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[get-pharmacy-dashboard-stats] 🚀 Starting batched pharmacy dashboard fetch');
    
    // Use admin client to bypass RLS (handles impersonation correctly)
    const supabaseClient = createAdminClient();
    
    // Still verify JWT for authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }
    
    // Create a temporary auth client just to verify the JWT
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.74.0');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body for effectiveUserId (for impersonation support)
    const { effectiveUserId } = await req.json().catch(() => ({ effectiveUserId: null }));
    
    // Use effectiveUserId if provided (for impersonation), otherwise use JWT user
    const userIdToQuery = effectiveUserId || user.id;

    console.log('[get-pharmacy-dashboard-stats] 👤 Query User ID:', userIdToQuery, effectiveUserId ? '(impersonation)' : '(direct)');

    // Get pharmacy ID for this user
    const { data: pharmacy } = await supabaseClient
      .from('pharmacies')
      .select('id')
      .eq('user_id', userIdToQuery)
      .maybeSingle();

    if (!pharmacy) {
      console.error('[get-pharmacy-dashboard-stats] ❌ Pharmacy not found');
      throw new Error('Pharmacy not found');
    }

    console.log('[get-pharmacy-dashboard-stats] 🏥 Pharmacy ID:', pharmacy.id);

    // Fetch all stats in parallel
    const [ordersRes, pendingRes, productsRes, activityRes, allOrdersRes] = await Promise.all([
      // Total orders count
      supabaseClient
        .from('order_lines')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_pharmacy_id', pharmacy.id),
      
      // Pending orders count
      supabaseClient
        .from('order_lines')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_pharmacy_id', pharmacy.id)
        .eq('status', 'pending'),
      
      // Products count
      supabaseClient
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('active', true),
      
      // Recent activity (5 most recent orders)
      supabaseClient
        .from('order_lines')
        .select('id, status, created_at, patient_name, order_id')
        .eq('assigned_pharmacy_id', pharmacy.id)
        .order('created_at', { ascending: false })
        .limit(5),
      
      // All orders for status breakdown (limit to recent 500 for performance)
      supabaseClient
        .from('order_lines')
        .select('status')
        .eq('assigned_pharmacy_id', pharmacy.id)
        .limit(500)
    ]);

    // Process orders by status breakdown
    const ordersByStatus = (allOrdersRes.data || []).reduce((acc, order: any) => {
      const status = order.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const stats: PharmacyDashboardStats = {
      ordersCount: ordersRes.count || 0,
      pendingOrdersCount: pendingRes.count || 0,
      productsCount: productsRes.count || 0,
      recentActivity: activityRes.data || [],
      ordersByStatus,
    };

    console.log('[get-pharmacy-dashboard-stats] ✅ Stats fetched successfully:', {
      ordersCount: stats.ordersCount,
      pendingOrdersCount: stats.pendingOrdersCount,
      productsCount: stats.productsCount,
      recentActivityCount: stats.recentActivity.length,
    });

    return new Response(
      JSON.stringify(stats),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30', // 30-second cache
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[get-pharmacy-dashboard-stats] ❌ Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
