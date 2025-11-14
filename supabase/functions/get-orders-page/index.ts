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
    const { page = 1, pageSize = 50, status, search, practiceId, role } = await req.json();

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
          products (
            name,
            dosage
          )
        )
      `, { count: 'exact' });

    // CRITICAL: Filter by role FIRST (before pagination)
    console.log(`[get-orders-page] 🎯 Filtering by role: ${role}`);
    
    if (role === 'doctor') {
      // For providers: practiceId parameter contains their user_id
      // Need to map user_id -> provider.id -> filter by order_lines.provider_id
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
      
      console.log(`[get-orders-page] 🔍 Provider filter: provider_id = ${providerRecord.id} (user: ${practiceId})`);
      
      // Get order IDs that have this provider in any order line
      const { data: orderLineData, error: orderLineError } = await supabase
        .from('order_lines')
        .select('order_id')
        .eq('provider_id', providerRecord.id);
      
      if (orderLineError) {
        console.error('[get-orders-page] ❌ Error fetching order_lines:', orderLineError);
        throw orderLineError;
      }
      
      const orderIds = [...new Set(orderLineData?.map(ol => ol.order_id) || [])];
      
      if (orderIds.length === 0) {
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
      
      console.log(`[get-orders-page] ✅ Found ${orderIds.length} unique orders for provider`);
      query = query.in('id', orderIds);
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
