import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, createAuthClient } from '../_shared/supabaseAdmin.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-csrf-token",
};

interface PlaceOrderRequest {
  cart_id: string;
  payment_method_id: string;
  discount_code?: string | null;
  discount_percentage?: number;
  merchant_fee_percentage?: number;
  csrf_token: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[place-order] Starting order placement");

  try {
    // Client for auth verification (with user JWT)
    const supabaseClient = createAuthClient(req.headers.get("Authorization"));

    // Admin client for efficient operations (bypasses RLS)
    const supabaseAdmin = createAdminClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("[place-order] Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body: PlaceOrderRequest = await req.json();
    const {
      cart_id,
      payment_method_id,
      discount_code,
      discount_percentage = 0,
      merchant_fee_percentage = 3.75,
      csrf_token,
    } = body;

    console.log("[place-order] Request params:", { cart_id, payment_method_id, user_id: user.id });

    // Validate CSRF token using shared validator
    if (!csrf_token) {
      console.error("[place-order] CSRF token missing");
      return new Response(
        JSON.stringify({ error: "CSRF token is required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: csrfData, error: csrfError } = await supabaseAdmin
      .from('user_sessions')
      .select('csrf_token')
      .eq('user_id', user.id)
      .eq('csrf_token', csrf_token)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (csrfError || !csrfData) {
      console.error("[place-order] CSRF validation failed:", csrfError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired CSRF token" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for active impersonation session
    let effectiveUserId = user.id;
    const { data: impersonationSession } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (impersonationSession) {
      effectiveUserId = impersonationSession.impersonated_user_id;
      console.log('[place-order] Impersonation detected:', {
        adminUserId: user.id,
        effectiveUserId
      });
    }

    // Fetch cart with all lines using admin client (bypasses RLS for efficiency)
    const { data: cart, error: cartError } = await supabaseAdmin
      .from("cart")
      .select(`
        id,
        doctor_id,
        lines:cart_lines(
          id,
          product_id,
          quantity,
          price_snapshot,
          shipping_speed,
          patient_id,
          patient_name,
          patient_email,
          patient_phone,
          patient_address,
          gender_at_birth,
          prescription_url,
          provider_id,
          assigned_pharmacy_id,
          destination_state,
          prescription_method,
          refills_allowed,
          refills_total
        )
      `)
      .eq("id", cart_id)
      .single();

    if (cartError || !cart || cart.lines.length === 0) {
      console.error("[place-order] Cart error:", cartError);
      return new Response(
        JSON.stringify({ error: "Cart not found or empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify cart belongs to effective user (accounts for impersonation)
    if (cart.doctor_id !== effectiveUserId) {
      console.error("[place-order] Cart ownership mismatch", {
        cartDoctorId: cart.doctor_id,
        effectiveUserId,
        isImpersonating: !!impersonationSession
      });
      return new Response(
        JSON.stringify({ error: "Unauthorized access to cart" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's effective practice and role info
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, practice_id, provider_id")
      .eq("id", user.id)
      .single();

    const isStaffAccount = userProfile?.role === "staff";
    const isProviderAccount = userProfile?.role === "provider";
    const effectivePracticeId = (isStaffAccount || isProviderAccount) ? userProfile.practice_id : user.id;
    const doctorIdForOrder = effectivePracticeId;

    // Get staff provider record if staff account
    let staffProviderRecord = null;
    if (isStaffAccount && userProfile?.provider_id) {
      const { data } = await supabaseAdmin
        .from("providers")
        .select("id")
        .eq("id", userProfile.provider_id)
        .single();
      staffProviderRecord = data;
    }

    // Get practice shipping address
    const { data: practice } = await supabaseAdmin
      .from("practices")
      .select("shipping_address")
      .eq("id", effectivePracticeId)
      .single();

    const practiceAddress = practice?.shipping_address;

    // Separate lines by ship_to destination
    const practiceLines = cart.lines.filter(line => !line.patient_id);
    const patientLines = cart.lines.filter(line => line.patient_id);

    console.log(`[place-order] Processing ${practiceLines.length} practice lines, ${patientLines.length} patient lines`);

    // Helper function to create shipping groups
    const createShippingGroups = (lines: any[]) => {
      const groups: Record<string, any> = {};
      for (const line of lines) {
        const key = `${line.assigned_pharmacy_id}_${line.shipping_speed}`;
        if (!groups[key]) {
          groups[key] = {
            pharmacy_id: line.assigned_pharmacy_id,
            shipping_speed: line.shipping_speed,
            line_ids: [],
            shipping_cost: 0,
          };
        }
        groups[key].line_ids.push(line.id);
      }
      return Object.values(groups);
    };

    // Helper function to calculate merchant fee
    const calculateMerchantFee = (subtotal: number, shipping: number): number => {
      return (subtotal + shipping) * (merchant_fee_percentage / 100);
    };

    // Helper function to get shipping cost for a line
    const getShippingCostForLine = (lineId: string, groups: any[]): number => {
      for (const group of groups) {
        if (group.line_ids.includes(lineId)) {
          return group.shipping_cost / group.line_ids.length;
        }
      }
      return 0;
    };

    // Calculate shipping costs
    const practiceShippingGroups = practiceLines.length > 0 ? createShippingGroups(practiceLines) : [];
    const patientShippingGroups = patientLines.length > 0 ? createShippingGroups(patientLines) : [];

    for (const group of [...practiceShippingGroups, ...patientShippingGroups]) {
      try {
        const { data: shippingData, error: shippingError } = await supabaseAdmin.functions.invoke(
          'calculate-shipping',
          {
            body: {
              pharmacy_id: group.pharmacy_id,
              shipping_speed: group.shipping_speed
            }
          }
        );
        
        if (!shippingError && shippingData?.shipping_cost) {
          group.shipping_cost = shippingData.shipping_cost;
        }
      } catch (error) {
        console.error('[place-order] Shipping calculation failed:', error);
        throw new Error(`Unable to calculate shipping for ${group.shipping_speed} shipping`);
      }
    }

    // Fetch payment method info
    const { data: selectedPaymentMethod } = await supabaseAdmin
      .from("payment_methods")
      .select("payment_type")
      .eq("id", payment_method_id)
      .single();

    // Prepare all orders
    const ordersToCreate: any[] = [];
    const orderLineMap: Map<number, any[]> = new Map(); // index -> order_lines array

    // Process practice lines
    for (const line of practiceLines) {
      const lineTotal = (line.price_snapshot || 0) * (line.quantity || 1);
      const discountAmount = lineTotal * (discount_percentage / 100);
      const lineShippingCost = getShippingCostForLine(line.id, practiceShippingGroups);
      const lineMerchantFee = calculateMerchantFee(lineTotal - discountAmount, lineShippingCost);
      const totalAfterDiscount = lineTotal - discountAmount + lineShippingCost + lineMerchantFee;

      const orderIndex = ordersToCreate.length;
      ordersToCreate.push({
        doctor_id: doctorIdForOrder,
        total_amount: totalAfterDiscount,
        subtotal_before_discount: lineTotal,
        discount_code: discount_code || null,
        discount_percentage: discount_percentage || 0,
        discount_amount: discountAmount || 0,
        shipping_total: lineShippingCost,
        merchant_fee_amount: lineMerchantFee,
        merchant_fee_percentage: merchant_fee_percentage,
        status: "pending",
        ship_to: "practice",
        practice_address: practiceAddress,
        formatted_shipping_address: practiceAddress,
        payment_method_id: payment_method_id,
        payment_method_used: selectedPaymentMethod?.payment_type || null,
      });

      const discountedPrice = line.price_snapshot * (1 - discount_percentage / 100);
      const providerIdForOrderLine = isStaffAccount && staffProviderRecord?.id 
        ? staffProviderRecord.id 
        : line.provider_id;

      orderLineMap.set(orderIndex, [{
        product_id: line.product_id,
        quantity: line.quantity || 1,
        price: discountedPrice,
        price_before_discount: line.price_snapshot,
        discount_percentage: discount_percentage || 0,
        discount_amount: ((line.price_snapshot - discountedPrice) * (line.quantity || 1)) || 0,
        shipping_speed: line.shipping_speed,
        shipping_cost: lineShippingCost,
        patient_id: line.patient_id,
        patient_name: line.patient_name,
        patient_email: line.patient_email,
        patient_phone: line.patient_phone,
        patient_address: line.patient_address,
        gender_at_birth: line.gender_at_birth || null,
        prescription_url: line.prescription_url,
        provider_id: providerIdForOrderLine,
        assigned_pharmacy_id: line.assigned_pharmacy_id,
        destination_state: line.destination_state,
        prescription_method: line.prescription_method,
        refills_allowed: line.refills_allowed || false,
        refills_total: line.refills_total || 0,
        refills_remaining: line.refills_total || 0,
      }]);
    }

    // Process patient lines
    for (const line of patientLines) {
      const lineTotal = (line.price_snapshot || 0) * (line.quantity || 1);
      const discountAmount = lineTotal * (discount_percentage / 100);
      const lineShippingCost = getShippingCostForLine(line.id, patientShippingGroups);
      const lineMerchantFee = calculateMerchantFee(lineTotal - discountAmount, lineShippingCost);
      const totalAfterDiscount = lineTotal - discountAmount + lineShippingCost + lineMerchantFee;

      const orderIndex = ordersToCreate.length;
      ordersToCreate.push({
        doctor_id: doctorIdForOrder,
        total_amount: totalAfterDiscount,
        subtotal_before_discount: lineTotal,
        discount_code: discount_code || null,
        discount_percentage: discount_percentage || 0,
        discount_amount: discountAmount || 0,
        shipping_total: lineShippingCost,
        merchant_fee_amount: lineMerchantFee,
        merchant_fee_percentage: merchant_fee_percentage,
        status: "pending",
        ship_to: "patient",
        practice_address: null,
        formatted_shipping_address: null,
        payment_method_id: payment_method_id,
        payment_method_used: selectedPaymentMethod?.payment_type || null,
      });

      const discountedPrice = line.price_snapshot * (1 - discount_percentage / 100);
      const providerIdForOrderLine = isStaffAccount && staffProviderRecord?.id 
        ? staffProviderRecord.id 
        : line.provider_id;

      orderLineMap.set(orderIndex, [{
        product_id: line.product_id,
        quantity: line.quantity || 1,
        price: discountedPrice,
        price_before_discount: line.price_snapshot,
        discount_percentage: discount_percentage || 0,
        discount_amount: ((line.price_snapshot - discountedPrice) * (line.quantity || 1)) || 0,
        shipping_speed: line.shipping_speed,
        shipping_cost: lineShippingCost,
        patient_id: line.patient_id,
        patient_name: line.patient_name,
        patient_email: line.patient_email,
        patient_phone: line.patient_phone,
        patient_address: line.patient_address,
        gender_at_birth: line.gender_at_birth || null,
        prescription_url: line.prescription_url,
        provider_id: providerIdForOrderLine,
        assigned_pharmacy_id: line.assigned_pharmacy_id,
        destination_state: line.destination_state,
        prescription_method: line.prescription_method,
        refills_allowed: line.refills_allowed || false,
        refills_total: line.refills_total || 0,
        refills_remaining: line.refills_total || 0,
      }]);
    }

    console.log(`[place-order] Creating ${ordersToCreate.length} orders with keys:`, ordersToCreate.length > 0 ? Object.keys(ordersToCreate[0]) : []);

    // Batch insert all orders using admin client (bypasses RLS)
    const { data: createdOrders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .insert(ordersToCreate)
      .select();

    if (ordersError || !createdOrders) {
      console.error("[place-order] Failed to create orders:", ordersError);
      throw new Error("Failed to create orders");
    }

    console.log(`[place-order] Created ${createdOrders.length} orders successfully`);

    // Batch insert all order lines using admin client (bypasses RLS)
    const allOrderLines: any[] = [];
    for (let i = 0; i < createdOrders.length; i++) {
      const order = createdOrders[i];
      const lines = orderLineMap.get(i) || [];
      for (const line of lines) {
        allOrderLines.push({
          ...line,
          order_id: order.id,
        });
      }
    }

    // CRITICAL: Validate we have order lines before proceeding
    if (allOrderLines.length === 0) {
      console.error("[place-order] No order lines generated - aborting order creation");
      
      // Rollback: Delete the orders we just created
      if (createdOrders.length > 0) {
        await supabaseAdmin
          .from("orders")
          .delete()
          .in("id", createdOrders.map(o => o.id));
      }
      
      throw new Error("Cannot create order without order lines");
    }

    const { error: orderLinesError } = await supabaseAdmin
      .from("order_lines")
      .insert(allOrderLines);

    if (orderLinesError) {
      console.error("[place-order] Failed to create order lines:", orderLinesError);
      
      // Rollback: Delete the orders we just created
      if (createdOrders.length > 0) {
        await supabaseAdmin
          .from("orders")
          .delete()
          .in("id", createdOrders.map(o => o.id));
      }
      
      throw new Error("Failed to create order lines");
    }

    console.log(`[place-order] Created ${allOrderLines.length} order lines successfully for ${createdOrders.length} orders`);

    // Process payments for each order
    const failedPayments: any[] = [];
    const failedOrders: string[] = [];

    for (const order of createdOrders) {
      try {
        const { data: paymentResult, error: paymentError } = await supabaseAdmin.functions.invoke(
          "authorizenet-charge-payment",
          {
            body: {
              order_id: order.id,
              payment_method_id: payment_method_id,
              amount: order.total_amount,
            },
            headers: {
              'x-csrf-token': csrf_token
            }
          }
        );

        if (paymentError || !paymentResult?.success) {
          // Mark order as payment_failed
          await supabaseAdmin
            .from("orders")
            .update({ payment_status: "payment_failed", status: "pending" })
            .eq("id", order.id);

          failedPayments.push({
            order_id: order.id,
            order_number: order.order_number,
            success: false,
            error: paymentResult?.error || paymentError?.message || "Payment processing failed",
            authorizenet_response: paymentResult?.authorizenet_response || null,
          });
          failedOrders.push(order.id);
        } else {
          // Payment succeeded - send to pharmacy API if enabled
          try {
            const pharmacyOrderLines = allOrderLines.filter(line => 
              line.order_id === order.id && line.assigned_pharmacy_id
            );

            // Group order lines by pharmacy_id to batch API calls
            const linesByPharmacy = new Map<string, any[]>();
            for (const line of pharmacyOrderLines) {
              const pharmacyId = line.assigned_pharmacy_id;
              if (!linesByPharmacy.has(pharmacyId)) {
                linesByPharmacy.set(pharmacyId, []);
              }
              linesByPharmacy.get(pharmacyId)!.push(line);
            }

            // Send one batched call per pharmacy
            for (const [pharmacyId, lines] of linesByPharmacy.entries()) {
              console.log(`[place-order] Sending ${lines.length} order lines to pharmacy ${pharmacyId}`);
              await supabaseAdmin.functions.invoke("send-order-to-pharmacy", {
                body: {
                  order_id: order.id,
                  order_line_ids: lines.map(l => l.id),
                  pharmacy_id: pharmacyId,
                }
              });
            }
          } catch (apiError) {
            console.error("[place-order] Failed to send order to pharmacy API:", apiError);
            // Non-fatal - order was already paid and created successfully
          }
        }
      } catch (error: any) {
        // Payment exception - mark order as failed
        await supabaseAdmin
          .from("orders")
          .update({ payment_status: "payment_failed", status: "pending" })
          .eq("id", order.id);

        failedPayments.push({
          order_id: order.id,
          order_number: order.order_number,
          success: false,
          error: error.message || "Payment processing failed",
          authorizenet_response: null,
        });
        failedOrders.push(order.id);
      }
    }

    // Increment discount code usage if all payments succeeded
    if (failedPayments.length === 0 && discount_code && createdOrders.length > 0) {
      try {
        await supabaseAdmin.rpc('increment_discount_usage', { 
          p_code: discount_code
        });
      } catch (error) {
        console.error("[place-order] Failed to increment discount usage:", error);
        // Non-fatal
      }
    }

    // CRITICAL: Clear cart lines after successful order placement
    if (failedPayments.length === 0) {
      console.log(`[place-order] Clearing cart_lines for cart_id: ${cart_id}`);
      const { data: deletedLines, error: deleteError } = await supabaseAdmin
        .from("cart_lines")
        .delete()
        .eq("cart_id", cart_id)
        .select('id');

      if (deleteError) {
        console.error("[place-order] Failed to clear cart:", deleteError);
        // Non-fatal but log for debugging
      } else {
        console.log(`[place-order] ✅ Successfully cleared ${deletedLines?.length || 0} cart lines`);
      }
    }

    const executionTimeSeconds = (Date.now() - startTime) / 1000;
    console.log(`[place-order] Completed in ${executionTimeSeconds}s - ${createdOrders.length} orders, ${failedPayments.length} payment failures`);

    return new Response(
      JSON.stringify({
        success: true,
        created_orders: createdOrders,
        failed_payments: failedPayments,
        failed_orders: failedOrders,
        execution_time_seconds: executionTimeSeconds,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[place-order] Fatal error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
