import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Batched Dashboard Stats Endpoint
 * 
 * Fetches all dashboard statistics in a single request using parallel queries
 * and SQL aggregations for maximum performance.
 * 
 * Returns: {
 *   ordersCount, productsCount, pendingOrdersCount, 
 *   usersCount, pendingRevenue, collectedRevenue
 * }
 */

Deno.serve(async (req) => {
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

    // Get request body
    const { role, isImpersonating, effectiveUserId } = await req.json();

    // When impersonating, use the effective user's ID for scoping
    const targetUserId = isImpersonating && effectiveUserId ? effectiveUserId : userId;

    const stats: Record<string, number> = {
      ordersCount: 0,
      productsCount: 0,
      pendingOrdersCount: 0,
      usersCount: 0,
      pendingRevenue: 0,
      collectedRevenue: 0,
    };

    // Execute all queries in parallel
    const promises: Promise<void>[] = [];

    // 1. Orders Count
    promises.push(
      (async () => {
        let count = 0;
        
        if (role === 'doctor') {
          const { count: orderCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .neq('status', 'cancelled')
            .neq('payment_status', 'payment_failed')
            .eq('doctor_id', targetUserId);
          count = orderCount || 0;
        } else if (role === 'provider') {
          const { data: providerData } = await supabase
            .from('providers')
            .select('id')
            .eq('user_id', targetUserId)
            .single();
          
          if (providerData) {
            const { data: orderLines } = await supabase
              .from('order_lines')
              .select('order_id, orders!inner(payment_status, status)')
              .eq('provider_id', providerData.id)
              .neq('orders.payment_status', 'payment_failed')
              .neq('orders.status', 'cancelled');
            
            const uniqueOrderIds = [...new Set(orderLines?.map(ol => ol.order_id) || [])];
            count = uniqueOrderIds.length;
          }
        } else if (role === 'pharmacy') {
          const { data: pharmacyData } = await supabase
            .from('pharmacies')
            .select('id')
            .eq('user_id', targetUserId)
            .maybeSingle();
          
          if (pharmacyData) {
            const { data: orderLines } = await supabase
              .from('order_lines')
              .select('order_id, orders!inner(payment_status, status)')
              .eq('assigned_pharmacy_id', pharmacyData.id)
              .neq('orders.payment_status', 'payment_failed')
              .neq('orders.status', 'cancelled');
            
            const uniqueOrderIds = [...new Set(orderLines?.map(ol => ol.order_id) || [])];
            count = uniqueOrderIds.length;
          }
        } else if (role === 'staff') {
          let practiceId: string | null = null;

          const { data: staffData } = await supabase
            .from('practice_staff')
            .select('practice_id')
            .eq('user_id', targetUserId)
            .eq('active', true)
            .maybeSingle();
          
          if (staffData?.practice_id) {
            practiceId = staffData.practice_id;
          } else {
            const { data: providerStaff } = await supabase
              .from('providers')
              .select('practice_id')
              .eq('user_id', targetUserId)
              .eq('active', true)
              .like('role_type', 'staff_%')
              .maybeSingle();

            if (providerStaff?.practice_id) {
              practiceId = providerStaff.practice_id;
            }
          }

          if (practiceId) {
            const { count: orderCount } = await supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .neq('status', 'cancelled')
              .neq('payment_status', 'payment_failed')
              .eq('doctor_id', practiceId);
            count = orderCount || 0;
          }
        } else if (role === 'admin') {
          const { count: orderCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .neq('status', 'cancelled')
            .neq('payment_status', 'payment_failed');
          count = orderCount || 0;
        }
        
        stats.ordersCount = count;
      })()
    );

    // 2. Products Count
    promises.push(
      (async () => {
        let count = 0;
        
        if (role === 'pharmacy') {
          const { data: pharmacyData } = await supabase
            .from('pharmacies')
            .select('id')
            .eq('user_id', targetUserId)
            .maybeSingle();
          
          if (pharmacyData) {
            const { count: productCount } = await supabase
              .from('product_pharmacies')
              .select('*', { count: 'exact', head: true })
              .eq('pharmacy_id', pharmacyData.id);
            count = productCount || 0;
          }
        } else if (role === 'admin' && !isImpersonating) {
          const { count: productCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('active', true);
          count = productCount || 0;
        } else {
          try {
            const { data: visibleProducts } = await supabase.rpc(
              'get_visible_products_for_effective_user',
              { p_effective_user_id: userId }
            );
            count = visibleProducts?.length || 0;
          } catch (error) {
            console.error('Error getting visible products:', error);
            count = 0;
          }
        }
        
        stats.productsCount = count;
      })()
    );

    // 3. Pending Orders Count (pharmacy only)
    if (role === 'pharmacy') {
      promises.push(
        (async () => {
          const { data: pharmacyData } = await supabase
            .from('pharmacies')
            .select('id')
            .eq('user_id', targetUserId)
            .maybeSingle();
          
          if (pharmacyData) {
            const { data: orderLines } = await supabase
              .from('order_lines')
              .select('order_id, orders!inner(status, payment_status)')
              .eq('assigned_pharmacy_id', pharmacyData.id)
              .neq('orders.payment_status', 'payment_failed')
              .eq('orders.status', 'pending');
            
            const uniqueOrderIds = [...new Set(orderLines?.map(ol => ol.order_id) || [])];
            stats.pendingOrdersCount = uniqueOrderIds.length;
          }
        })()
      );
    }

    // 4. Users Count (admin only)
    if (role === 'admin') {
      promises.push(
        (async () => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('active', true);
          stats.usersCount = count || 0;
        })()
      );
    }

    // 5. Pending Revenue
    promises.push(
      (async () => {
        let revenue = 0;
        
        if (role === 'doctor') {
          const { data: orders } = await supabase
            .from('orders')
            .select('total_amount')
            .neq('status', 'cancelled')
            .neq('payment_status', 'payment_failed')
            .eq('doctor_id', targetUserId)
            .eq('status', 'pending');
          
          revenue = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
        } else if (role === 'provider') {
          const { data: providerData } = await supabase
            .from('providers')
            .select('id')
            .eq('user_id', targetUserId)
            .single();
          
          if (providerData) {
            const { data: orderLines } = await supabase
              .from('order_lines')
              .select('price, quantity, orders!inner(status, payment_status)')
              .eq('provider_id', providerData.id)
              .neq('orders.payment_status', 'payment_failed')
              .eq('orders.status', 'pending');
            
            revenue = orderLines?.reduce((sum, line) => 
              sum + (Number(line.price || 0) * Number(line.quantity || 1)), 0) || 0;
          }
        } else if (role === 'pharmacy') {
          const { data: pharmacyData } = await supabase
            .from('pharmacies')
            .select('id')
            .eq('user_id', targetUserId)
            .maybeSingle();
          
          if (pharmacyData) {
            const { data: orderLines } = await supabase
              .from('order_lines')
              .select('price, quantity, orders!inner(status, payment_status)')
              .eq('assigned_pharmacy_id', pharmacyData.id)
              .neq('orders.payment_status', 'payment_failed')
              .eq('orders.status', 'pending');
            
            revenue = orderLines?.reduce((sum, line) => 
              sum + (Number(line.price || 0) * Number(line.quantity || 1)), 0) || 0;
          }
        } else if (role === 'staff') {
          let practiceId: string | null = null;

          const { data: staffData } = await supabase
            .from('practice_staff')
            .select('practice_id')
            .eq('user_id', targetUserId)
            .eq('active', true)
            .maybeSingle();
          
          if (staffData?.practice_id) {
            practiceId = staffData.practice_id;
          } else {
            const { data: providerStaff } = await supabase
              .from('providers')
              .select('practice_id')
              .eq('user_id', targetUserId)
              .eq('active', true)
              .like('role_type', 'staff_%')
              .maybeSingle();

            if (providerStaff?.practice_id) {
              practiceId = providerStaff.practice_id;
            }
          }

          if (practiceId) {
            const { data: orders } = await supabase
              .from('orders')
              .select('total_amount')
              .neq('status', 'cancelled')
              .neq('payment_status', 'payment_failed')
              .eq('doctor_id', practiceId)
              .eq('status', 'pending');
            
            revenue = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
          }
        } else {
          const { data: orders } = await supabase
            .from('orders')
            .select('total_amount')
            .neq('status', 'cancelled')
            .neq('payment_status', 'payment_failed')
            .eq('status', 'pending');
          
          revenue = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
        }
        
        stats.pendingRevenue = revenue;
      })()
    );

    // 6. Collected Revenue
    promises.push(
      (async () => {
        let revenue = 0;
        
        if (role === 'doctor') {
          const { data: orders } = await supabase
            .from('orders')
            .select('total_amount')
            .neq('status', 'cancelled')
            .neq('payment_status', 'payment_failed')
            .eq('doctor_id', targetUserId)
            .eq('payment_status', 'paid');
          
          revenue = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
        } else if (role === 'provider') {
          const { data: providerData } = await supabase
            .from('providers')
            .select('id')
            .eq('user_id', targetUserId)
            .single();
          
          if (providerData) {
            const { data: orderLines } = await supabase
              .from('order_lines')
              .select('price, quantity, orders!inner(status, payment_status)')
              .eq('provider_id', providerData.id)
              .neq('orders.payment_status', 'payment_failed')
              .neq('orders.status', 'cancelled')
              .eq('orders.payment_status', 'paid');
            
            revenue = orderLines?.reduce((sum, line) => 
              sum + (Number(line.price || 0) * Number(line.quantity || 1)), 0) || 0;
          }
        } else if (role === 'pharmacy') {
          const { data: pharmacyData } = await supabase
            .from('pharmacies')
            .select('id')
            .eq('user_id', targetUserId)
            .maybeSingle();
          
          if (pharmacyData) {
            const { data: orderLines } = await supabase
              .from('order_lines')
              .select('price, quantity, orders!inner(status, payment_status)')
              .eq('assigned_pharmacy_id', pharmacyData.id)
              .neq('orders.payment_status', 'payment_failed')
              .neq('orders.status', 'cancelled')
              .eq('orders.payment_status', 'paid');
            
            revenue = orderLines?.reduce((sum, line) => 
              sum + (Number(line.price || 0) * Number(line.quantity || 1)), 0) || 0;
          }
        } else if (role === 'staff') {
          const { data: staffData } = await supabase
            .from('practice_staff')
            .select('practice_id')
            .eq('user_id', targetUserId)
            .eq('active', true)
            .maybeSingle();
          
          if (staffData?.practice_id) {
            const { data: orders } = await supabase
              .from('orders')
              .select('total_amount')
              .neq('status', 'cancelled')
              .neq('payment_status', 'payment_failed')
              .eq('doctor_id', staffData.practice_id)
              .eq('payment_status', 'paid');
            
            revenue = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
          }
        } else {
          const { data: orders } = await supabase
            .from('orders')
            .select('total_amount')
            .neq('status', 'cancelled')
            .neq('payment_status', 'payment_failed')
            .eq('payment_status', 'paid');
          
          revenue = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
        }
        
        stats.collectedRevenue = revenue;
      })()
    );

    // Wait for all queries to complete in parallel
    await Promise.all(promises);

    console.log('[Dashboard Stats] Batched response for user:', userId, stats);

    return new Response(
      JSON.stringify({ success: true, data: stats }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30, s-maxage=30',
        } 
      }
    );

  } catch (error) {
    console.error('[Dashboard Stats] Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
