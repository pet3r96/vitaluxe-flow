import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

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
      return new Response(
        JSON.stringify({ error: 'Unauthorized: missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!token || token.length < 10) {
      console.error('[get-orders-page] Invalid Authorization token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[get-orders-page] Missing Supabase envs');
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('[get-orders-page] Auth failed:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const { page = 1, pageSize = 50, status, search, practiceId, role, startDate, endDate } = await req.json();

    // Normalize role: provider -> doctor
    const roleNorm = role === 'provider' ? 'doctor' : role;

    console.log(`[get-orders-page] 🔍 Request:`, { 
      page, 
      pageSize, 
      role, 
      scopeId: practiceId,
      authUserId: userId 
    });
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
        doctor_id,
        order_lines (
          id,
          status,
          patient_name,
          prescription_url,
          prescription_method,
          shipping_speed,
          tracking_number,
          products (
            name,
            dosage,
            product_types (
              name
            )
          )
        )
      `, { count: 'exact' });

    // Apply date range filter if provided (defaults to last 90 days)
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 90);
    const dateFrom = startDate || defaultStartDate.toISOString();
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // CRITICAL: Filter by role FIRST (before pagination)
    console.log(`[get-orders-page] 🎯 Filtering by role: ${role}`);
    
    if (role === 'doctor') {
      // OPTIMIZED: Use efficient query with new composite index
      // Get provider ID for this user
      const { data: providerRecord, error: providerError } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', practiceId)
        .eq('active', true)
        .maybeSingle();
      
      if (providerError) {
        console.error('[get-orders-page] ❌ Error fetching provider:', providerError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch provider record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!providerRecord) {
        console.warn('[get-orders-page] ⚠️ No active provider found for user');
        return new Response(
          JSON.stringify({
            orders: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
            hasNextPage: false,
            debug: { reason: 'no_provider_record', userId: practiceId }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[get-orders-page] 🔍 Provider filter: provider_id = ${providerRecord.id}`);
      
      // OPTIMIZED: Uses idx_order_lines_provider_created_order index
      const { data: orderIds, error: orderIdsError } = await supabase
        .from('order_lines')
        .select('order_id')
        .eq('provider_id', providerRecord.id)
        .gte('created_at', dateFrom)
        .limit(1000); // Safety limit
      
      if (orderIdsError) {
        console.error('[get-orders-page] ❌ Error fetching order IDs:', orderIdsError);
        throw orderIdsError;
      }
      
      const uniqueOrderIds = [...new Set(orderIds?.map(ol => ol.order_id) || [])];
      
      if (uniqueOrderIds.length === 0) {
        console.log('[get-orders-page] ℹ️ No orders found for provider');
        return new Response(
          JSON.stringify({
            orders: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
            hasNextPage: false,
            debug: { reason: 'no_orders', providerId: providerRecord.id }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[get-orders-page] ✅ Found ${uniqueOrderIds.length} orders for provider`);
      query = query.in('id', uniqueOrderIds);
    } else if (role === 'practice' || role === 'staff') {
      // Practice owners and staff see orders where doctor_id = practice owner's user_id
      // OPTIMIZED: Uses idx_orders_doctor_status_created index
      console.log(`[get-orders-page] ${role === 'staff' ? 'Staff' : 'Practice'} filter: doctor_id = ${practiceId}`);
      query = query.eq('doctor_id', practiceId);
    } else if (role === 'pharmacy') {
      // ADDED: Pharmacy role handling
      // Get pharmacy ID for this user
      const { data: pharmacyRecord, error: pharmacyError } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('user_id', practiceId)
        .eq('active', true)
        .maybeSingle();
      
      if (pharmacyError) {
        console.error('[get-orders-page] ❌ Error fetching pharmacy:', pharmacyError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch pharmacy record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!pharmacyRecord) {
        console.warn('[get-orders-page] ⚠️ No active pharmacy found for user');
        return new Response(
          JSON.stringify({
            orders: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
            hasNextPage: false,
            debug: { reason: 'no_pharmacy_record', userId: practiceId }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[get-orders-page] 🔍 Pharmacy filter: assigned_pharmacy_id = ${pharmacyRecord.id}`);
      
      // Filter orders by pharmacy assignment in order_lines
      const { data: orderIds, error: orderIdsError } = await supabase
        .from('order_lines')
        .select('order_id')
        .eq('assigned_pharmacy_id', pharmacyRecord.id)
        .gte('created_at', dateFrom)
        .limit(1000);
      
      if (orderIdsError) {
        console.error('[get-orders-page] ❌ Error fetching order IDs:', orderIdsError);
        throw orderIdsError;
      }
      
      const uniqueOrderIds = [...new Set(orderIds?.map(ol => ol.order_id) || [])];
      
      if (uniqueOrderIds.length === 0) {
        console.log('[get-orders-page] ℹ️ No orders found for pharmacy');
        return new Response(
          JSON.stringify({
            orders: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
            hasNextPage: false,
            debug: { reason: 'no_orders', pharmacyId: pharmacyRecord.id }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[get-orders-page] ✅ Found ${uniqueOrderIds.length} orders for pharmacy`);
      query = query.in('id', uniqueOrderIds);
    } else if (role === 'admin') {
      // Admin sees all orders - no filter
      console.log('[get-orders-page] Admin role - no filtering');
    } else {
      console.warn(`[get-orders-page] ⚠️ Unknown role: ${role}, defaulting to practice filter`);
      query = query.eq('doctor_id', practiceId);
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

    if (duration > 1000) {
      console.warn(`[get-orders-page] ⚠️ SLOW QUERY: ${duration.toFixed(2)}ms - check indexes and filters`);
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
