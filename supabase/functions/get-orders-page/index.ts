import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to extract meaningful error messages
const parseErr = (e: any): string => {
  if (typeof e?.message === 'string') return e.message;
  if (typeof e?.error === 'string') return e.error;
  if (typeof e?.details === 'string') return e.details;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error occurred';
  }
};

// Helper to check if string looks like UUID v4
const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
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
    const body = await req.json();
    const { 
      page = 1, 
      pageSize: rawPageSize = 50, 
      status, 
      search, 
      practiceId, 
      role, 
      startDate, 
      endDate 
    } = body;

    // Input validation: clamp pageSize between 1 and 50
    const safePageSize = Math.min(Math.max(Number(rawPageSize) || 25, 1), 50);

    // NO ROLE NORMALIZATION - keep roles separate
    const roleNorm = role;
    console.log('[get-orders-page] Incoming role:', roleNorm);

    // Default to last 90 days if no startDate provided
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 90);
    const dateFrom = startDate || defaultStartDate.toISOString();
    
    // Validate date range
    if (endDate && dateFrom && new Date(dateFrom) > new Date(endDate)) {
      return new Response(
        JSON.stringify({ error: 'Invalid date range: startDate must be before endDate' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-orders-page] 🔍 Request:`, { 
      page, 
      pageSize: safePageSize, 
      role: roleNorm, 
      scopeId: practiceId,
      authUserId: userId,
      status,
      search: search ? `"${search.substring(0, 20)}..."` : null,
      dateFrom,
      endDate
    });
    const startTime = performance.now();

    // Calculate pagination
    const from = (page - 1) * safePageSize;
    const to = from + safePageSize - 1;

    // Build base query with minimal columns for list view
    // CRITICAL: Remove !inner to prevent row inflation, limit nested to 1 row
    let query = supabase
      .from('orders')
      .select(`
        id,
        created_at,
        status,
        total_amount,
        payment_status,
        doctor_id,
        ship_to,
        order_lines (
          id,
          status,
          patient_name,
          patient_id,
          shipping_speed,
          products (
            name,
            product_types ( name )
          )
      )
    `, { count: 'exact', head: false })
    .not('status', 'is', null); // Use partial index

  // Apply date range filter
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Role-based filtering
    console.log(`[get-orders-page] 🎯 Filtering by role: ${roleNorm}`);
    
    if (roleNorm === 'doctor') {
      // DOCTOR = practice owner
      console.log('[get-orders-page] Doctor (practice owner) filter. practiceId:', practiceId, 'userId:', userId);
      
      const doctorFilterId = practiceId || userId;
      
      // TWO-PHASE: Fetch order IDs first
      const { data: orderIds, error: orderIdsError } = await supabase
        .from('orders')
        .select('id')
        .eq('doctor_id', doctorFilterId)
        .gte('created_at', dateFrom)
        .not('status', 'is', null)
        .limit(2000);
      
      if (orderIdsError) {
        console.error('[get-orders-page] ❌ Error fetching order IDs:', parseErr(orderIdsError));
        return new Response(
          JSON.stringify({ error: `Failed to fetch order IDs: ${parseErr(orderIdsError)}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const uniqueOrderIds = orderIds?.map(o => o.id) || [];
      
      if (uniqueOrderIds.length === 0) {
        console.log('[get-orders-page] ℹ️ No orders found for doctor');
        return new Response(
          JSON.stringify({
            orders: [],
            total: 0,
            page,
            pageSize: safePageSize,
            totalPages: 0,
            hasNextPage: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[get-orders-page] ✅ Found ${uniqueOrderIds.length} orders for doctor`);
      query = query.in('id', uniqueOrderIds);
      
    } else if (roleNorm === 'provider') {
      // PROVIDER = regular prescriber
      // Get provider ID for this user
      const { data: providerRecord, error: providerError } = await supabase
        .from('providers')
        .select('id, practice_id')
        .eq('user_id', practiceId || userId)
        .eq('active', true)
        .maybeSingle();
      
      if (providerError) {
        console.error('[get-orders-page] ❌ Error fetching provider:', parseErr(providerError));
        return new Response(
          JSON.stringify({ error: `Failed to fetch provider record: ${parseErr(providerError)}` }),
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
            pageSize: safePageSize,
            totalPages: 0,
            hasNextPage: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[get-orders-page] 🔍 Provider filter: provider_id = ${providerRecord.id}`);
      
      // Fetch order IDs using security definer function (bypasses expensive RLS)
      const { data: orderIds, error: orderIdsError } = await supabase
        .rpc('get_order_lines_by_provider', {
          provider_uuid: providerRecord.id,
          from_date: dateFrom,
          limit_count: 2000
        });
      
      if (orderIdsError) {
        console.error('[get-orders-page] ❌ Error fetching order IDs:', parseErr(orderIdsError));
        return new Response(
          JSON.stringify({ error: `Failed to fetch order IDs: ${parseErr(orderIdsError)}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const uniqueOrderIds = [...new Set(orderIds?.map((row: any) => row.order_id) || [])];
      
      if (uniqueOrderIds.length === 0) {
        console.log('[get-orders-page] ℹ️ No orders found for provider');
        return new Response(
          JSON.stringify({
            orders: [],
            total: 0,
            page,
            pageSize: safePageSize,
            totalPages: 0,
            hasNextPage: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[get-orders-page] ✅ Found ${uniqueOrderIds.length} unique orders for provider`);
      query = query.in('id', uniqueOrderIds);
      
    } else if (roleNorm === 'practice' || roleNorm === 'staff') {
      console.log(`[get-orders-page] ${roleNorm === 'staff' ? 'Staff' : 'Practice'} filter: doctor_id = ${practiceId}`);
      
      // Fetch order IDs using security definer function (bypasses expensive RLS)
      const { data: orderIds, error: orderIdsError } = await supabase
        .rpc('get_orders_by_practice', {
          practice_uuid: practiceId,
          from_date: dateFrom,
          limit_count: 2000
        });
      
      if (orderIdsError) {
        console.error('[get-orders-page] ❌ Error fetching order IDs:', parseErr(orderIdsError));
        return new Response(
          JSON.stringify({ error: `Failed to fetch order IDs: ${parseErr(orderIdsError)}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const uniqueOrderIds = orderIds?.map((row: any) => row.id) || [];
      
      if (uniqueOrderIds.length === 0) {
        console.log(`[get-orders-page] ℹ️ No orders found for ${roleNorm}`);
        return new Response(
          JSON.stringify({
            orders: [],
            total: 0,
            page,
            pageSize: safePageSize,
            totalPages: 0,
            hasNextPage: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[get-orders-page] ✅ Found ${uniqueOrderIds.length} orders for ${roleNorm}`);
      query = query.in('id', uniqueOrderIds);
      
    } else if (roleNorm === 'pharmacy') {
      // Get pharmacy ID for this user
      const { data: pharmacyRecord, error: pharmacyError } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('user_id', practiceId)
        .eq('active', true)
        .maybeSingle();
      
      if (pharmacyError) {
        console.error('[get-orders-page] ❌ Error fetching pharmacy:', parseErr(pharmacyError));
        return new Response(
          JSON.stringify({ error: `Failed to fetch pharmacy record: ${parseErr(pharmacyError)}` }),
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
            pageSize: safePageSize,
            totalPages: 0,
            hasNextPage: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[get-orders-page] 🔍 Pharmacy filter: assigned_pharmacy_id = ${pharmacyRecord.id}`);
      
      // Fetch order IDs using security definer function (bypasses expensive RLS)
      const { data: orderIds, error: orderIdsError } = await supabase
        .rpc('get_order_lines_by_pharmacy', {
          pharmacy_uuid: pharmacyRecord.id,
          from_date: dateFrom,
          limit_count: 2000
        });
      
      if (orderIdsError) {
        console.error('[get-orders-page] ❌ Error fetching order IDs:', parseErr(orderIdsError));
        return new Response(
          JSON.stringify({ error: `Failed to fetch order IDs: ${parseErr(orderIdsError)}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const uniqueOrderIds = [...new Set(orderIds?.map((row: any) => row.order_id) || [])];
      
      if (uniqueOrderIds.length === 0) {
        console.log('[get-orders-page] ℹ️ No orders found for pharmacy');
        return new Response(
          JSON.stringify({
            orders: [],
            total: 0,
            page,
            pageSize: safePageSize,
            totalPages: 0,
            hasNextPage: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[get-orders-page] ✅ Found ${uniqueOrderIds.length} orders for pharmacy`);
      query = query.in('id', uniqueOrderIds);
      
    } else if (roleNorm === 'downline') {
      // Downline rep: lookup rep record, get linked practices
      console.log(`[get-orders-page] Downline role - practiceId (user_id): ${practiceId}`);
      
      const { data: repData, error: repError } = await supabase
        .from('reps')
        .select('id')
        .eq('user_id', practiceId)
        .eq('role', 'downline')
        .maybeSingle();
      
      if (repError || !repData) {
        console.warn('[get-orders-page] Downline rep record not found:', repError?.message || 'No data');
        return new Response(
          JSON.stringify({
            orders: [],
            totalCount: 0,
            page: page,
            pageSize: safePageSize,
            totalPages: 0,
            hasNextPage: false,
            metadata: { hasRepRecord: false, emptyReason: 'no_rep' }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const { data: practiceLinks, error: linksError } = await supabase
        .from('rep_practice_links')
        .select('practice_id')
        .eq('rep_id', repData.id)
        .limit(5000);
      
      const practiceIds = practiceLinks?.map(pl => pl.practice_id) || [];
      
      if (practiceIds.length === 0) {
        console.warn('[get-orders-page] No practices linked to downline rep:', repData.id);
        return new Response(
          JSON.stringify({
            orders: [],
            totalCount: 0,
            page: page,
            pageSize: safePageSize,
            totalPages: 0,
            hasNextPage: false,
            metadata: { hasRepRecord: true, practiceCount: 0, emptyReason: 'no_practices' }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[get-orders-page] ✅ Downline ${repData.id}: found ${practiceIds.length} practices`);
      query = query.in('doctor_id', practiceIds);
      
    } else if (roleNorm === 'topline') {
      // Topline rep: lookup rep record, get all downlines + their practices
      console.log(`[get-orders-page] Topline role - practiceId (user_id): ${practiceId}`);
      
      const { data: repData, error: repError } = await supabase
        .from('reps')
        .select('id')
        .eq('user_id', practiceId)
        .eq('role', 'topline')
        .maybeSingle();
      
      if (repError || !repData) {
        console.warn('[get-orders-page] Topline rep record not found:', repError?.message || 'No data');
        return new Response(
          JSON.stringify({
            orders: [],
            totalCount: 0,
            page: page,
            pageSize: safePageSize,
            totalPages: 0,
            hasNextPage: false,
            metadata: { hasRepRecord: false, emptyReason: 'no_rep' }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get all downline reps under this topline
      const { data: downlineReps } = await supabase
        .from('reps')
        .select('id')
        .eq('assigned_topline_id', repData.id)
        .eq('role', 'downline');
      
      const allRepIds = [repData.id, ...(downlineReps?.map(r => r.id) || [])];
      
      // Get all practices linked to these reps
      const { data: practiceLinks } = await supabase
        .from('rep_practice_links')
        .select('practice_id')
        .in('rep_id', allRepIds)
        .limit(5000);
      
      const practiceIds = [...new Set(practiceLinks?.map(pl => pl.practice_id) || [])];
      
      if (practiceIds.length === 0) {
        console.warn('[get-orders-page] No practices linked to topline/downlines:', repData.id);
        return new Response(
          JSON.stringify({
            orders: [],
            totalCount: 0,
            page: page,
            pageSize: safePageSize,
            totalPages: 0,
            hasNextPage: false,
            metadata: { hasRepRecord: true, practiceCount: 0, emptyReason: 'no_practices' }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[get-orders-page] ✅ Topline ${repData.id}: found ${practiceIds.length} practices across ${allRepIds.length} reps`);
      query = query.in('doctor_id', practiceIds);
      
    } else if (roleNorm === 'admin') {
      // Admin sees all orders - no filter
      console.log('[get-orders-page] Admin role - no filtering');
    } else {
      console.warn(`[get-orders-page] ⚠️ Unknown role: ${roleNorm}, defaulting to practice filter`);
      query = query.eq('doctor_id', practiceId);
    }

    // Status filter
    if (status && status !== 'all') {
      console.log(`[get-orders-page] Filtering by status: ${status}`);
      query = query.eq('status', status);
    }

    // Two-phase search implementation
    if (search && search.trim().length >= 3) {
      const searchTerm = search.trim();
      console.log(`[get-orders-page] Applying search: "${searchTerm}"`);
      
      // Phase 1: Check if search looks like UUID
      if (isUUID(searchTerm)) {
        console.log('[get-orders-page] Search is UUID - filtering by order ID');
        query = query.eq('id', searchTerm);
      } else {
        // Phase 2: Search by patient name in order_lines
        console.log('[get-orders-page] Search is text - looking up patient names');
        const { data: searchOrderIds, error: searchError } = await supabase
          .from('order_lines')
          .select('order_id')
          .ilike('patient_name', `%${searchTerm}%`)
          .gte('created_at', dateFrom)
          .limit(2000);
        
        if (searchError) {
          console.error('[get-orders-page] ❌ Search error:', parseErr(searchError));
          return new Response(
            JSON.stringify({ error: `Search failed: ${parseErr(searchError)}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const searchUniqueOrderIds = [...new Set(searchOrderIds?.map(ol => ol.order_id) || [])];
        
        if (searchUniqueOrderIds.length === 0) {
          console.log('[get-orders-page] ℹ️ No orders match search term');
          return new Response(
            JSON.stringify({
              orders: [],
              total: 0,
              page,
              pageSize: safePageSize,
              totalPages: 0,
              hasNextPage: false,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log(`[get-orders-page] ✅ Found ${searchUniqueOrderIds.length} orders matching search`);
        query = query.in('id', searchUniqueOrderIds);
      }
    }

    // Apply ordering and pagination
    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    console.log(`[get-orders-page] Executing query with range ${from}-${to}`);
    const { data: orders, error: ordersError, count } = await query;

    if (ordersError) {
      console.error('[get-orders-page] ❌ Query error:', parseErr(ordersError));
      return new Response(
        JSON.stringify({ error: `Query failed: ${parseErr(ordersError)}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const duration = performance.now() - startTime;
    console.log(`[get-orders-page] ✅ SUCCESS: ${orders?.length || 0} orders fetched in ${duration.toFixed(2)}ms (total: ${count || 0})`);

    // Performance warning
    if (duration > 1000) {
      console.warn(`[get-orders-page] ⚠️ SLOW QUERY: ${duration.toFixed(2)}ms - check indexes and filters`);
    }
    
    // Diagnostic logging for empty results
    if (count === 0) {
      console.warn(`[get-orders-page] ⚠️ Zero orders returned`, {
        role: roleNorm,
        scopeId: practiceId,
        status,
        search,
        dateFrom,
        endDate
      });
    }

    return new Response(
      JSON.stringify({
        orders: orders || [],
        total: count || 0,
        page,
        pageSize: safePageSize,
        totalPages: Math.ceil((count || 0) / safePageSize),
        hasNextPage: to < (count || 0) - 1,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[get-orders-page] ❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: parseErr(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
