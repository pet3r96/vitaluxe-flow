import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { orderId, newStatus, changeReason } = await req.json();

    if (!orderId || !newStatus) {
      return new Response(JSON.stringify({ error: 'Missing orderId or newStatus' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Status change request: order ${orderId} → ${newStatus} by user ${user.id}`);

    // Get user's role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'No role found for user' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userRole = roleData.role;

    // Get the order to check permissions
    const { data: orderData, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, doctor_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !orderData) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Permission checks
    const isAdmin = userRole === 'admin';
    const isOwnOrder = orderData.doctor_id === user.id;
    
    // For pharmacy, check if they're assigned to this order
    let canPharmacyUpdate = false;
    if (userRole === 'pharmacy') {
      const { data: pharmacyData } = await supabaseClient
        .from('pharmacies')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (pharmacyData) {
        const { data: assignedLine } = await supabaseClient
          .from('order_lines')
          .select('id')
          .eq('order_id', orderId)
          .eq('assigned_pharmacy_id', pharmacyData.id)
          .limit(1)
          .maybeSingle();
        
        canPharmacyUpdate = !!assignedLine;
      }
    }

    // Admins can update any order, practices can update their own, pharmacies can update assigned
    if (!isAdmin && !isOwnOrder && !canPharmacyUpdate) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update the order status with manual override
    const oldStatus = orderData.status;
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: newStatus,
        status_manual_override: true,
        status_override_reason: changeReason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Failed to update order status:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert status change into history
    const { error: historyError } = await supabaseClient
      .from('order_status_history')
      .insert({
        order_id: orderId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: user.id,
        changed_by_role: userRole,
        change_reason: changeReason || null,
        is_manual_override: true,
        metadata: {
          user_email: user.email,
          timestamp: new Date().toISOString(),
        },
      });

    if (historyError) {
      console.error('Failed to log status history:', historyError);
    }

    console.log(`Order ${orderId} status updated: ${oldStatus} → ${newStatus}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Order status updated successfully',
        oldStatus,
        newStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in update-order-status:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});