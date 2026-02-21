import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, createAuthClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { cacheDelPattern } from '../_shared/cache.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateRequestSize } from '../_shared/requestSizeValidator.ts';
import { placeOrderSchema } from '../_shared/zodSchemas.ts';

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
  const ipAddress = getClientIP(req);
  edgeLogger.info("Starting order placement", { ipAddress });

  try {
    // PHASE 3: Request size validation
    const sizeValidation = validateRequestSize(req, 'place-order', corsHeaders);
    if (sizeValidation) return sizeValidation;

    // Client for auth verification (with user JWT)
    const supabaseClient = createAuthClient(req.headers.get("Authorization"));

    // Admin client for efficient operations (bypasses RLS)
    const supabaseAdmin = createAdminClient();

    // PHASE 3: Rate limiting (20 requests/hour)
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      ipAddress,
      'place-order',
      { maxRequests: 20, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { function: 'place-order', ip: ipAddress });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      edgeLogger.error("Authentication failed", authError);
      edgeLogger.logOperation({
        ip_address: ipAddress,
        operation: 'place-order',
        success: false,
        duration_ms: Date.now() - startTime,
        metadata: { error: 'Authentication failed' }
      });
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

    edgeLogger.info("Place order request", { cart_id, payment_method_id });

    // Verify payment method exists and is active
    const { data: paymentMethod, error: pmError } = await supabaseAdmin
      .from('practice_payment_methods')
      .select('id, card_last_five, card_type, status')
      .eq('id', payment_method_id)
      .single();

    if (pmError || !paymentMethod) {
      edgeLogger.error('[PLACE_ORDER] Payment method not found', pmError);
      return new Response(
        JSON.stringify({ error: 'Payment method not found' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PHASE 6: Payment method verification logging
    edgeLogger.info('[PLACE_ORDER] Payment method verified', {
      payment_method_id: paymentMethod.id,
      card_last_five: paymentMethod.card_last_five,
      card_type: paymentMethod.card_type,
      status: paymentMethod.status,
      practice_id_match: 'will_check_later'
    });

    if (paymentMethod.status !== 'active') {
      edgeLogger.error('[PLACE_ORDER] Payment method not active', { status: paymentMethod.status });
      return new Response(
        JSON.stringify({ error: `Cannot charge ${paymentMethod.status} payment method` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info('[PLACE_ORDER] Payment method validated', {
      last5: paymentMethod.card_last_five,
      status: paymentMethod.status
    });

    // Validate CSRF token using shared validator
    if (!csrf_token) {
      edgeLogger.error("CSRF token missing");
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
      edgeLogger.error("CSRF validation failed", csrfError);
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
      edgeLogger.info('Impersonation detected', { adminUserId: user.id, effectiveUserId });
    }

    // Get user's effective practice and role info EARLY (before cart ownership check)
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, practice_id, provider_id")
      .eq("id", user.id)
      .single();

    const isStaffAccount = userProfile?.role === "staff";
    const isProviderAccount = userProfile?.role === "provider";

    // Get practice ID for staff via practice_staff table if needed
    let effectivePracticeId = (isStaffAccount || isProviderAccount) ? userProfile.practice_id : user.id;

    if (isStaffAccount && !effectivePracticeId) {
      const { data: staffRecord } = await supabaseAdmin
        .from('practice_staff')
        .select('practice_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .single();
      effectivePracticeId = staffRecord?.practice_id || user.id;
    }

    const doctorIdForOrder = effectivePracticeId;

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
          refills_total,
          variant_id,
          days_supply
        )
      `)
      .eq("id", cart_id)
      .single();

    if (cartError || !cart || cart.lines.length === 0) {
      edgeLogger.error("Cart error", cartError);
      return new Response(
        JSON.stringify({ error: "Cart not found or empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify cart belongs to effective user (accounts for impersonation AND staff users)
    // Compare cart ownership with practice ID for staff users
    const cartOwnerIdToCheck = effectivePracticeId || effectiveUserId;
    if (cart.doctor_id !== cartOwnerIdToCheck) {
      edgeLogger.error("Cart ownership mismatch", undefined, {
        cartDoctorId: cart.doctor_id,
        cartOwnerIdToCheck,
        effectiveUserId,
        effectivePracticeId,
        isStaffAccount,
        isImpersonating: !!impersonationSession
      });
      return new Response(
        JSON.stringify({ error: "Unauthorized access to cart" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    edgeLogger.info("Processing cart lines", { practiceLines: practiceLines.length, patientLines: patientLines.length });

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
        edgeLogger.error('Shipping calculation failed', error);
        throw new Error(`Unable to calculate shipping for ${group.shipping_speed} shipping`);
      }
    }

    // Fetch payment method info
    const { data: selectedPaymentMethod } = await supabaseAdmin
      .from("practice_payment_methods")
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
        practice_id: effectivePracticeId,
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
        variant_id: line.variant_id || null,
        days_supply: line.days_supply || null,
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
        practice_id: effectivePracticeId,
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
        shipping_speed: line.shipping_speed || 'first_class',
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
        variant_id: line.variant_id || null,
        days_supply: line.days_supply || null,
      }]);
    }

    edgeLogger.info('[STEP 1] Orders calculated (NOT created yet)', { 
      orderCount: ordersToCreate.length, 
      totalAmount: ordersToCreate.reduce((sum, o) => sum + o.total_amount, 0),
      timestamp: new Date().toISOString()
    });

    // ========================================
    // CRITICAL: ATTEMPT PAYMENT FIRST (before creating orders)
    // ========================================
    edgeLogger.info('[STEP 2] Attempting payment BEFORE order creation', {
      payment_method_id,
      totalAmount: ordersToCreate.reduce((sum, o) => sum + o.total_amount, 0),
      timestamp: new Date().toISOString()
    });

    // Process payment for the total cart amount
    const totalAmount = ordersToCreate.reduce((sum, o) => sum + o.total_amount, 0);
    
    // PHASE 2: Diagnostic logging before payment invocation
    edgeLogger.info('[PLACE_ORDER] Invoking authorizenet-charge-payment', {
      payment_method_id,
      card_last_five: paymentMethod.card_last_five,
      amount: totalAmount,
      doctor_id: doctorIdForOrder,
      has_csrf_token: !!csrf_token,
      timestamp: new Date().toISOString()
    });
    
    const { data: paymentResult, error: paymentError } = await supabaseAdmin.functions.invoke(
      "authorizenet-charge-payment",
      {
        body: {
          amount: totalAmount,
          payment_method_id: payment_method_id,
          doctor_id: doctorIdForOrder, // For authorization check
        },
        headers: {
          'Authorization': req.headers.get('Authorization') || '',  // ✅ Pass user's auth header
          'x-csrf-token': csrf_token
        }
      }
    );

    // PHASE 2: Diagnostic logging after payment invocation
    edgeLogger.info('[PLACE_ORDER] Payment invocation completed', {
      success: paymentResult?.success,
      has_error: !!paymentError,
      error_message: paymentError?.message || paymentResult?.error,
      transaction_id: paymentResult?.transaction_id,
      timestamp: new Date().toISOString()
    });

    // If payment failed, return error immediately WITHOUT creating orders
    if (paymentError || !paymentResult?.success) {
      edgeLogger.error('[STEP 2] Payment failed - NO ORDERS CREATED', null, {
        error: paymentResult?.error || paymentError?.message,
        authorizenet_code: paymentResult?.authorizenet_response?.messages?.message?.[0]?.code,
        authorizenet_message: paymentResult?.authorizenet_response?.messages?.message?.[0]?.text,
        timestamp: new Date().toISOString()
      });

      // Log failed operation
      edgeLogger.logOperation({
        user_id: effectiveUserId,
        ip_address: ipAddress,
        operation: 'place-order',
        success: false,
        duration_ms: Date.now() - startTime,
        metadata: {
          reason: 'payment_declined',
          error: paymentResult?.error || paymentError?.message
        }
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: paymentResult?.error || paymentError?.message || "Payment declined",
          created_orders: [],
          failed_payments: [{
            order_index: 0,
            amount: totalAmount,
            error: paymentResult?.error || paymentError?.message || "Payment declined",
            payment_method_id: payment_method_id,
            authorizenet_response: paymentResult?.authorizenet_response || null,
          }],
          failed_orders: [],
          deleted_cart_line_ids: [],
          authorizenet_response: paymentResult?.authorizenet_response || null,
        }),
        {
          status: 200, // Return 200 with success: false (not a server error, payment declined)
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    edgeLogger.info('[STEP 2] Payment succeeded - proceeding to create orders', {
      transaction_id: paymentResult?.transaction_id,
      timestamp: new Date().toISOString()
    });

    // ========================================
    // PAYMENT SUCCEEDED - NOW CREATE ORDERS
    // ========================================
    edgeLogger.info('[STEP 3] Creating orders in database', { 
      orderCount: ordersToCreate.length,
      timestamp: new Date().toISOString()
    });

    // Add payment info to orders
    const ordersWithPayment = ordersToCreate.map(order => ({
      ...order,
      authorizenet_transaction_id: paymentResult.transaction_id,
      payment_status: 'paid',
    }));

    // Batch insert all orders using admin client (bypasses RLS)
    const { data: createdOrders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .insert(ordersWithPayment)
      .select();

    if (ordersError || !createdOrders) {
      edgeLogger.error('[STEP 3] Failed to create orders after successful payment', ordersError);
      // CRITICAL: Payment succeeded but order creation failed - this needs manual intervention
      throw new Error("Payment succeeded but order creation failed. Contact support with transaction ID: " + paymentResult.transaction_id);
    }

    edgeLogger.info('[STEP 3] Orders created successfully', { 
      orderCount: createdOrders.length,
      timestamp: new Date().toISOString()
    });

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
      edgeLogger.error('No order lines generated - aborting order creation', new Error('No order lines'));
      
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
      edgeLogger.error('Failed to create order lines - DETAILED DIAGNOSTICS', {
        error: orderLinesError,
        errorCode: orderLinesError.code,
        errorMessage: orderLinesError.message,
        errorDetails: orderLinesError.details,
        errorHint: orderLinesError.hint,
        orderLineCount: allOrderLines.length,
        sampleOrderLine: allOrderLines[0],
        allOrderLineKeys: allOrderLines.length > 0 ? Object.keys(allOrderLines[0]) : [],
        missingShippingSpeeds: allOrderLines.filter(line => !line.shipping_speed).length,
        invalidShippingSpeeds: allOrderLines.filter(line => 
          line.shipping_speed && !['overnight', '2day', 'priority', 'first_class', 'ground'].includes(line.shipping_speed)
        ).map(line => ({ id: line.id, speed: line.shipping_speed })),
        missingOrderIds: allOrderLines.filter(line => !line.order_id).length,
        missingProductIds: allOrderLines.filter(line => !line.product_id).length,
        missingPatientNames: allOrderLines.filter(line => !line.patient_name || line.patient_name.trim() === '').length,
        missingPrices: allOrderLines.filter(line => line.price === null || line.price === undefined).length,
        invalidPrescriptionMethods: allOrderLines.filter(line => 
          line.prescription_method && !['upload', 'written'].includes(line.prescription_method)
        ).map(line => ({ id: line.id, method: line.prescription_method })),
        invalidRefills: allOrderLines.filter(line => 
          (line.refills_total !== null && (line.refills_total < 0 || line.refills_total > 3)) ||
          (line.refills_remaining !== null && (line.refills_remaining < 0 || line.refills_remaining > 3))
        ).map(line => ({ id: line.id, total: line.refills_total, remaining: line.refills_remaining })),
        timestamp: new Date().toISOString()
      });
      
      // Rollback: Delete the orders we just created
      if (createdOrders.length > 0) {
        await supabaseAdmin
          .from("orders")
          .delete()
          .in("id", createdOrders.map(o => o.id));
      }
      
      throw new Error(`Failed to create order lines: ${orderLinesError.message} | Code: ${orderLinesError.code} | Hint: ${orderLinesError.hint || 'none'}`);
    }

    edgeLogger.info('[STEP 4] Order lines created successfully', { 
      orderLineCount: allOrderLines.length, 
      orderCount: createdOrders.length,
      timestamp: new Date().toISOString()
    });

    // ========================================
    // SEND TO PHARMACY API (if applicable)
    // ========================================
    edgeLogger.info('[STEP 5] Sending orders to pharmacy APIs', {
      timestamp: new Date().toISOString()
    });

    for (const order of createdOrders) {
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
          edgeLogger.info('[STEP 5] Sending order lines to pharmacy', { 
            lineCount: lines.length, 
            pharmacyId,
            order_id: order.id 
          });
          await supabaseAdmin.functions.invoke("send-order-to-pharmacy", {
            body: {
              order_id: order.id,
              order_line_ids: lines.map(l => l.id),
              pharmacy_id: pharmacyId,
            }
          });
        }
      } catch (apiError) {
        edgeLogger.error('[STEP 5] Failed to send order to pharmacy API', apiError, { order_id: order.id });
        // Non-fatal - order was already paid and created successfully
      }
    }

    // ========================================
    // CLEAR CART
    // ========================================
    let deletedCartLineIds: string[] = [];
    edgeLogger.info('[STEP 6] Clearing cart', { 
      cartId: cart_id,
      timestamp: new Date().toISOString()
    });
    
    const { data: deletedLines, error: deleteError } = await supabaseAdmin
      .from("cart_lines")
      .delete()
      .eq("cart_id", cart_id)
      .select('id');

    if (deleteError) {
      edgeLogger.error('[STEP 6] Failed to clear cart', deleteError);
    } else if (deletedLines) {
      deletedCartLineIds = deletedLines.map(l => l.id);
      edgeLogger.info('[STEP 6] Cart cleared successfully', { deletedCount: deletedCartLineIds.length });
    }

    // Increment discount code usage
    if (discount_code && createdOrders.length > 0) {
      try {
        await supabaseAdmin.rpc('increment_discount_usage', { 
          p_code: discount_code
        });
      } catch (error) {
        edgeLogger.error('Failed to increment discount usage', error);
        // Non-fatal
      }
    }

    // Cart lines already cleared above (after order creation, before payment)

    const executionTimeSeconds = (Date.now() - startTime) / 1000;
    edgeLogger.info('[COMPLETE] Order placement completed successfully', { 
      executionTime: executionTimeSeconds, 
      orderCount: createdOrders.length 
    });

    // Invalidate caches after successful order placement
    if (createdOrders.length > 0) {
      try {
        await Promise.all([
          cacheDelPattern('dashboard:*'),
          cacheDelPattern('top_products:*'),
          cacheDelPattern('pharmacy_dashboard:*'),
        ]);
        edgeLogger.info('Cache invalidated after order placement');
      } catch (cacheError) {
        edgeLogger.error('Failed to invalidate cache', cacheError);
        // Non-fatal - order was placed successfully
      }
    }

    const successCount = createdOrders.length;
    
    // Log successful operation
    edgeLogger.logOperation({
      user_id: effectiveUserId,
      ip_address: ipAddress,
      operation: 'place-order',
      success: true,
      duration_ms: Date.now() - startTime,
      metadata: {
        cart_id,
        order_count: successCount,
        total_amount: createdOrders.reduce((sum, o) => sum + o.total_amount, 0)
      }
    });

    // Audit log for order placement
    if (successCount > 0) {
      await supabaseAdmin.from('audit_logs').insert({
        action_type: 'order_placed',
        user_id: effectiveUserId,
        entity_type: 'orders',
        entity_id: createdOrders[0]?.id,
        ip_address: ipAddress,
        details: {
          order_count: successCount,
          cart_id,
          payment_method_id,
          timestamp: new Date().toISOString()
        }
      });
    }

    // SUCCESS: All orders created and paid
    edgeLogger.info('[COMPLETE] Order placement successful', {
      orderCount: createdOrders.length,
      totalAmount: createdOrders.reduce((sum, o) => sum + o.total_amount, 0),
      executionTime: executionTimeSeconds,
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        created_orders: createdOrders,
        failed_payments: [],
        failed_orders: [],
        deleted_cart_line_ids: deletedCartLineIds,
        execution_time_seconds: executionTimeSeconds,
        message: 'All orders placed and paid successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    edgeLogger.error('Fatal error in place-order', error);
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
