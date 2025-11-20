import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { validateInput, updateShippingSchema } from '../_shared/zodSchemas.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';
import { validateRequestSize } from '../_shared/requestSizeValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

// Normalize status values to match database enum
const normalizeStatus = (status?: string): string | undefined => {
  if (!status) return undefined;
  const lower = status.toLowerCase();
  
  // Map synonyms to our enum values
  if (lower === 'processing' || lower === 'fulfilling' || lower === 'in_progress') {
    return 'filled';
  }
  
  // Valid enum values
  const validStatuses = ['pending', 'filled', 'shipped', 'delivered', 'denied', 'change_requested'];
  if (validStatuses.includes(lower)) {
    return lower;
  }
  
  return undefined; // unsupported
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // PHASE 3 SECURITY: Request size validation
  const sizeValidation = validateRequestSize(req, 'update-shipping-info', corsHeaders);
  if (sizeValidation) return sizeValidation;

  const startTime = Date.now();
  const ipAddress = getClientIP(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createAuthClient(authHeader);
    const supabaseAdmin = createAdminClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      edgeLogger.error('Update shipping auth error', userError);
      throw new Error(`Authentication failed: ${userError.message}`);
    }
    if (!user) {
      throw new Error('No user found');
    }

    // PHASE 3: Rate limiting (30 requests/hour)
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      user.id,
      'update-shipping-info',
      { maxRequests: 30, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { userId: user.id, function: 'update-shipping-info' });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('Update shipping request authenticated');

    // PHASE 3 SECURITY: Zod schema validation (replaces custom validation)
    const body = await req.json();
    const validation = validateInput(updateShippingSchema, body);

    if (!validation.success) {
      edgeLogger.warn('Validation failed (update-shipping-info)', { errors: validation.errors });
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data', 
          details: validation.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData = validation.data;

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || requestData.csrf_token;
    const { valid, error: csrfError } = await validateCSRFToken(supabase, user.id, csrfToken);
    if (!valid) {
      edgeLogger.error('Update shipping CSRF validation failed', { error: csrfError });
      return new Response(
        JSON.stringify({ error: csrfError || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user role using roleChecker
    const { requireRole, getUserRoles } = await import('../_shared/roleChecker.ts');
    await requireRole(supabase, user.id, ['admin', 'pharmacy'], 'Insufficient permissions');
    
    // Get user role for audit logging
    const userRoles = await getUserRoles(supabase, user.id);
    const userRole = userRoles[0] || 'unknown';

    const { orderLineId, trackingNumber, carrier, status, estimatedDelivery } = requestData;

    edgeLogger.info('Update shipping payload received', { orderLineId });

    // Normalize status
    const normalizedStatus = normalizeStatus(status);
    if (status && !normalizedStatus) {
      edgeLogger.error('Unsupported shipping status value', null, { status });
      throw new Error(`Unsupported status value: "${status}". Allowed values: pending, filled, shipped, denied, change_requested`);
    }

    // Get current order line data
    const { data: currentLine, error: fetchError } = await supabase
      .from('order_lines')
      .select('tracking_number, shipping_carrier, status')
      .eq('id', orderLineId)
      .single();

    if (fetchError) throw fetchError;

    // Prepare update object - only include changed fields
    const updateData: any = {};
    
    if (trackingNumber !== undefined && trackingNumber !== currentLine.tracking_number) {
      updateData.tracking_number = trackingNumber;
    }
    
    if (carrier !== undefined && carrier !== currentLine.shipping_carrier) {
      updateData.shipping_carrier = carrier;
    }
    
    if (normalizedStatus && normalizedStatus !== currentLine.status) {
      updateData.status = normalizedStatus;
      // Update timestamps based on status
      if (normalizedStatus === 'shipped' && currentLine.status !== 'shipped') {
        updateData.shipped_at = new Date().toISOString();
      }
      if (normalizedStatus === 'filled' && currentLine.status !== 'filled') {
        updateData.processing_at = new Date().toISOString();
      }
      if (normalizedStatus === 'delivered' && currentLine.status !== 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }
    }

    edgeLogger.info('Update shipping data prepared');

    // If nothing changed, return success without updating
    if (Object.keys(updateData).length === 0) {
      edgeLogger.info('No shipping changes detected, skipping update');
      return new Response(
        JSON.stringify({ success: true, message: 'No changes detected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update order line
    const { error: updateError } = await supabase
      .from('order_lines')
      .update(updateData)
      .eq('id', orderLineId);

    if (updateError) throw updateError;

    // Create audit log
    const { error: auditError } = await supabase
      .from('shipping_audit_logs')
      .insert({
        order_line_id: orderLineId,
        updated_by: user.id,
        updated_by_role: userRole,
        old_tracking_number: currentLine.tracking_number,
        new_tracking_number: trackingNumber,
        old_carrier: currentLine.shipping_carrier,
        new_carrier: carrier,
        old_status: currentLine.status,
        new_status: normalizedStatus || currentLine.status,
        change_description: 'Shipping information updated', // Default value since field removed from schema
      });

    if (auditError) {
      edgeLogger.error('Audit log error (non-fatal)', auditError, {
        orderLineId,
        errorMessage: auditError.message,
        errorCode: auditError.code
      });
      // Don't fail the request if audit logging fails
    }

    // ✅ DISABLED: Auto-create EasyPost shipment - easypost_shipment_id column doesn't exist in order_lines table
    // This functionality is disabled because the database schema doesn't support it yet
    // To enable: add easypost_shipment_id column to order_lines table first

    return new Response(
      JSON.stringify({ success: true, message: 'Shipping info updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    edgeLogger.error('Error updating shipping info', error, {
      errorMessage: error.message,
      errorCode: error.code,
      errorStack: error.stack
    });
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack  // Include stack trace for debugging
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
