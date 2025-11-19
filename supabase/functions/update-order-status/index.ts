import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { cacheDelPattern } from '../_shared/cache.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';
import { validateInput, updateOrderStatusSchema } from '../_shared/zodSchemas.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const ipAddress = getClientIP(req);

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));
    const supabaseAdmin = createAdminClient();

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PHASE 3: Rate limiting (30 requests/hour)
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      ipAddress,
      'update-order-status',
      { maxRequests: 30, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { function: 'update-order-status', ipAddress });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabaseClient, user.id, csrfToken);
    if (!valid) {
      edgeLogger.error('CSRF validation failed', undefined, { error: csrfError });
      return new Response(
        JSON.stringify({ error: csrfError || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    
    // PHASE 3: Schema validation
    const validation = validateInput(updateOrderStatusSchema, body);
    if (!validation.success) {
      edgeLogger.warn('Validation failed', { errors: validation.errors });
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { order_id: orderId, status: newStatus, notes: changeReason } = validation.data;

    // PHASE 3: ID validation (tenant isolation)
    const { valid: ownsResource, error: idError } = await validateUserOwnsResource(
      supabaseAdmin,
      user.id,
      'order',
      orderId
    );

    if (!ownsResource) {
      edgeLogger.error('ID validation failed', undefined, { error: idError, userId: user.id, orderId });
      return new Response(
        JSON.stringify({ error: idError || 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('Status change request', { hasOrderId: !!orderId, newStatus });

    // PHASE 2: Use centralized role checker
    const { hasRole, getUserRoles } = await import('../_shared/roleChecker.ts');
    const isAdmin = await hasRole(supabaseAdmin, user.id, ['admin', 'super_admin']);
    const isPharmacy = await hasRole(supabaseAdmin, user.id, ['pharmacy']);
    const userRoles = await getUserRoles(supabaseAdmin, user.id);
    const userRole = userRoles[0] || 'unknown';

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
    const isOwnOrder = orderData.doctor_id === user.id;
    
    // For pharmacy, check if they're assigned to this order
    let canPharmacyUpdate = false;
    if (isPharmacy) {
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
      edgeLogger.logOperation({
        user_id: user.id,
        ip_address: ipAddress,
        operation: 'update_order_status',
        success: false,
        duration_ms: Date.now() - startTime,
        metadata: { orderId, reason: 'permission_denied' }
      });
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
      edgeLogger.error('Failed to update order status', updateError);
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
      edgeLogger.error('Failed to log status history', historyError);
    }

    edgeLogger.info('Order status updated', { orderId, oldStatus, newStatus });

    // Invalidate caches after status update
    try {
      await Promise.all([
        cacheDelPattern('dashboard:*'),
        cacheDelPattern('pharmacy_dashboard:*'),
      ]);
      edgeLogger.info('Cache invalidated after status update');
    } catch (cacheError) {
      edgeLogger.error('Failed to invalidate cache', cacheError);
      // Non-fatal - status was updated successfully
    }

    // Audit log for order status change
    await supabaseAdmin.from('audit_logs').insert({
      action_type: 'order_status_changed',
      user_id: user.id,
      entity_type: 'orders',
      entity_id: orderId,
      ip_address: ipAddress,
      details: {
        old_status: oldStatus,
        new_status: newStatus,
        change_reason: changeReason,
        manual_override: true,
        timestamp: new Date().toISOString()
      }
    });

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
    edgeLogger.error('Error in update-order-status', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});