import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { validateUpdateShippingRequest } from "../_shared/requestValidators.ts";
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

interface UpdateShippingRequest {
  orderLineId: string;
  trackingNumber?: string;
  carrier?: string;
  status?: string;
  changeDescription?: string;
}

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

    // Parse JSON with error handling
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      edgeLogger.error('Invalid JSON in update shipping request', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = validateUpdateShippingRequest(requestData);
    if (!validation.valid) {
      edgeLogger.warn('Update shipping validation failed', { errors: validation.errors });
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data', 
          details: validation.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
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

    const { orderLineId, trackingNumber, carrier, status, changeDescription }: UpdateShippingRequest = requestData;

    edgeLogger.info('Update shipping payload received', { orderLineId });

    // Normalize status
    const normalizedStatus = normalizeStatus(status);
    if (status && !normalizedStatus) {
      edgeLogger.error('Unsupported shipping status value', null, { status });
      throw new Error(`Unsupported status value: "${status}". Allowed values: pending, filled, shipped, denied, change_requested`);
    }

    // Get current order line data including easypost_shipment_id
    const { data: currentLine, error: fetchError } = await supabase
      .from('order_lines')
      .select('tracking_number, shipping_carrier, status, easypost_shipment_id')
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
        change_description: changeDescription || 'Shipping information updated',
      });

    if (auditError) {
      edgeLogger.error('Audit log error (non-fatal)', auditError);
      // Don't fail the request if audit logging fails
    }

    // Auto-create EasyPost shipment if status is 'shipped' and tracking number is provided
    if (normalizedStatus === 'shipped' && trackingNumber && !currentLine.easypost_shipment_id) {
      try {
        edgeLogger.info('Auto-creating EasyPost shipment for order line', { orderLineId });
        
        // Get order line details for shipment creation
        const { data: orderLineDetails, error: orderLineError } = await supabase
          .from('order_lines')
          .select(`
            id,
            patient_name,
            patient_address,
            destination_state,
            assigned_pharmacy_id,
            pharmacies!inner(
              name,
              address_street,
              address_city,
              address_state,
              address_zip
            )
          `)
          .eq('id', orderLineId)
          .single();

        if (orderLineError) {
          edgeLogger.error('Error getting order line details for shipment', orderLineError, { orderLineId });
        } else if (orderLineDetails.pharmacies) {
          // Parse patient address for street/city/zip (state comes from destination_state field)
          const patientAddressParts = orderLineDetails.patient_address?.split(',') || [];
          const patientStreet = patientAddressParts[0]?.trim() || '';
          const patientCityStateZip = patientAddressParts[1]?.trim() || '';
          const patientCity = patientCityStateZip.split(' ')[0] || '';
          const patientZip = patientCityStateZip.split(' ')[2] || '';
          // Use direct destination_state field instead of parsing
          const patientState = orderLineDetails.destination_state || '';

          // Create shipment via EasyPost API
          const shipmentResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/create-easypost-shipment`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
              'x-csrf-token': csrfToken || ''
            },
            body: JSON.stringify({
              order_line_id: orderLineId,
              from_address: {
                street: (Array.isArray(orderLineDetails.pharmacies) ? orderLineDetails.pharmacies[0] : orderLineDetails.pharmacies)?.address_street || '',
                city: (Array.isArray(orderLineDetails.pharmacies) ? orderLineDetails.pharmacies[0] : orderLineDetails.pharmacies)?.address_city || '',
                state: (Array.isArray(orderLineDetails.pharmacies) ? orderLineDetails.pharmacies[0] : orderLineDetails.pharmacies)?.address_state || '',
                zip: (Array.isArray(orderLineDetails.pharmacies) ? orderLineDetails.pharmacies[0] : orderLineDetails.pharmacies)?.address_zip || '',
                name: (Array.isArray(orderLineDetails.pharmacies) ? orderLineDetails.pharmacies[0] : orderLineDetails.pharmacies)?.name || ''
              },
              to_address: {
                street: patientStreet,
                city: patientCity,
                state: patientState,
                zip: patientZip,
                name: orderLineDetails.patient_name
              }
            })
          });

          if (shipmentResponse.ok) {
            const shipmentData = await shipmentResponse.json();
            edgeLogger.info('Auto-created EasyPost shipment', { shipmentId: shipmentData.shipment?.id });
          } else {
            edgeLogger.error('Failed to auto-create EasyPost shipment');
          }
        }
      } catch (error) {
        edgeLogger.error('Error auto-creating EasyPost shipment', error, { orderLineId });
        // Don't fail the main request if shipment creation fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Shipping info updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    edgeLogger.error('Error updating shipping info', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
