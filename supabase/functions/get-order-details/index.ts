import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, createAuthClient } from '../_shared/supabaseAdmin.ts';

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
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createAuthClient(authHeader);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'orderId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use admin client to bypass RLS and get full order details
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("orders")
      .select(`
        *,
        order_lines (
          id,
          quantity,
          price,
          patient_name,
          patient_id,
          status,
          shipping_speed,
          shipping_cost,
          assigned_pharmacy_id,
          product_id,
          prescription_url,
          prescription_method,
          tracking_number,
          shipped_at,
          delivered_at,
          products (
            id,
            name,
            dosage,
            product_types (
              name
            )
          ),
          pharmacies (
            id,
            name
          )
        ),
        practice_payment_methods (
          card_type,
          card_last_five,
          card_expiry
        ),
        profiles!orders_doctor_id_fkey (
          name,
          prescriber_name,
          full_name,
          email
        )
      `)
      .eq('id', orderId)
      .single();

    if (error || !data) {
      console.error('[get-order-details] Error fetching order:', error);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[get-order-details] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
