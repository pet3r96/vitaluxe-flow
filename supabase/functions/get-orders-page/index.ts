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
      console.error('[get-orders-page] Missing Authorization header');
      throw new Error('Missing authorization header');
    }

    // Extract the JWT token from the Authorization header
    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with the user's JWT token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );

    // Verify the user by getting their data from the JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('[get-orders-page] Auth verification failed:', userError);
      throw new Error('Unauthorized');
    }
    
    console.log('[get-orders-page] ✅ User authenticated:', user.id);

    const { page = 1, pageSize = 50, status, search, practiceId, role } = await req.json();
    
    if (!practiceId) {
      throw new Error('practiceId is required');
    }

    console.log(`[get-orders-page] 🔍 Request:`, { 
      page, 
      pageSize, 
      role, 
      scopeId: practiceId,
      authUserId: user.id 
    });
    const startTime = performance.now();

    // Calculate offset for pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Build query with minimal columns for list view
    // CRITICAL: Use LEFT join for patient_accounts (not inner) to avoid RLS filtering out orders
    let query = supabase
      .from('orders')
      .select(`
        id,
        created_at,
        status,
        total_amount,
        payment_status,
        doctor_id,
        patient_accounts (
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
    console.log(`[get-orders-page] 🎯 Filtering by role: ${role}`);
    
    if (role === 'doctor') {
      // CRITICAL FIX: doctor_id in orders table stores providers.user_id (not providers.id)
      // practiceId parameter is actually the auth user.id for doctor role
      console.log(`[get-orders-page] Doctor filter: doctor_id = ${practiceId}`);
      query = query.eq('doctor_id', practiceId);
    } else if (role === 'practice') {
      // For practice role: get all provider user_ids for this practice, then filter orders
      console.log(`[get-orders-page] Practice filter: fetching providers for practice ${practiceId}`);
      
      const { data: providers, error: providersError } = await supabase
        .from('providers')
        .select('user_id')
        .eq('practice_id', practiceId)
        .eq('active', true);
      
      if (providersError) {
        console.error('[get-orders-page] ❌ Error fetching providers:', providersError);
        throw new Error('Failed to fetch practice providers');
      }
      
      const providerUserIds = providers?.map(p => p.user_id) || [];
      console.log(`[get-orders-page] Found ${providerUserIds.length} active providers for practice`);
      
      if (providerUserIds.length === 0) {
        console.warn('[get-orders-page] ⚠️ No active providers found for practice - returning empty');
        return new Response(
          JSON.stringify({
            orders: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
            hasNextPage: false,
            debug: { providersFound: 0, practiceId }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      query = query.in('doctor_id', providerUserIds);
    } else if (role === 'admin') {
      // Admin sees all orders - no filter
      console.log('[get-orders-page] Admin role - no filtering');
    } else {
      console.warn(`[get-orders-page] ⚠️ Unknown role: ${role}, defaulting to practice filter`);
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
      console.error('[get-orders-page] ❌ Query error:', ordersError);
      throw ordersError;
    }

    const duration = performance.now() - startTime;
    console.log(`[get-orders-page] ✅ SUCCESS: ${orders?.length || 0} orders fetched in ${duration.toFixed(2)}ms (total: ${count || 0})`);

    if (duration > 2000) {
      console.warn(`[get-orders-page] ⚠️ SLOW QUERY: ${duration.toFixed(2)}ms`);
    }
    
    // Diagnostic warning if no orders found
    if (count === 0) {
      console.warn(`[get-orders-page] ⚠️ Zero orders returned - check filters (role: ${role}, scopeId: ${practiceId})`);
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
