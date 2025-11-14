import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { page = 1, pageSize = 50, status, search, practiceId, role } = await req.json();
    
    if (!practiceId) {
      throw new Error('practiceId is required');
    }

    console.log(`[get-orders-page] Fetching page ${page} for ${role || 'practice'} ${practiceId}`);
    const startTime = performance.now();

    // Calculate offset for pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Build query with minimal columns for list view
    let query = supabase
      .from('orders')
      .select(`
        id,
        created_at,
        status,
        total_amount,
        payment_status,
        patient_accounts!inner (
          id,
          first_name,
          last_name
        ),
        order_lines (
          id,
          status,
          products (
            name,
            dosage
          )
        )
      `, { count: 'exact' });

    // CRITICAL: Filter by role FIRST (before pagination)
    console.log(`[get-orders-page] Filtering by role: ${role}`);
    if (role === 'doctor') {
      query = query.eq('doctor_id', practiceId);
    } else if (role === 'practice') {
      query = query.eq('practice_id', practiceId);
    } else if (role === 'admin') {
      // Admin sees all orders - no filter
      console.log('[get-orders-page] Admin role - no filtering');
    } else {
      console.warn(`[get-orders-page] Unknown role: ${role}, defaulting to practice filter`);
      query = query.eq('practice_id', practiceId);
    }

    // Apply additional filters (after role filter, before pagination)
    if (status && status !== 'all') {
      console.log(`[get-orders-page] Filtering by status: ${status}`);
      query = query.eq('status', status);
    }

    if (search) {
      console.log(`[get-orders-page] Filtering by search: ${search}`);
      // Search in patient name or order ID
      query = query.or(`id.ilike.%${search}%,patient_accounts.first_name.ilike.%${search}%,patient_accounts.last_name.ilike.%${search}%`);
    }

    // CRITICAL: Apply ordering and pagination LAST
    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    console.log(`[get-orders-page] Executing query with range ${from}-${to}`);
    const { data: orders, error: ordersError, count } = await query;

    if (ordersError) {
      console.error('[get-orders-page] Error:', ordersError);
      throw ordersError;
    }

    const duration = performance.now() - startTime;
    console.log(`[get-orders-page] ✅ Fetched ${orders?.length || 0} orders in ${duration.toFixed(2)}ms`);

    if (duration > 2000) {
      console.warn(`[get-orders-page] ⚠️ SLOW QUERY: ${duration.toFixed(2)}ms`);
    }

    return new Response(
      JSON.stringify({
        orders: orders || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
        hasNextPage: to < (count || 0) - 1,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[get-orders-page] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
