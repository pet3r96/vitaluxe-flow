import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { validateUpdateShippingRequest } from "../_shared/requestValidators.ts";
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

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

  try {
    // Parse JSON with error handling
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      console.error('Invalid JSON in request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = validateUpdateShippingRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data', 
          details: validation.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    // Get current user
    const token = authHeader.replace('Bearer', '').trim();
    if (!token) {
      throw new Error('Missing bearer token');
    }
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      console.error('Auth error:', userError);
      throw new Error(`Authentication failed: ${userError.message}`);
    }
    if (!user) {
      throw new Error('No user found');
    }

    console.log('Authenticated user:', user.id);

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabase, user.id, csrfToken);
    if (!valid) {
      console.error('CSRF validation failed:', csrfError);
      return new Response(
        JSON.stringify({ error: csrfError || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const userRole = roleData?.role;
    if (!userRole || !['admin', 'pharmacy'].includes(userRole)) {
      throw new Error('Insufficient permissions');
    }

    const { orderLineId, trackingNumber, carrier, status, changeDescription }: UpdateShippingRequest = requestData;

    console.log('Incoming payload:', { orderLineId, trackingNumber, carrier, status });

    // Normalize status
    const normalizedStatus = normalizeStatus(status);
    if (status && !normalizedStatus) {
      console.error('Unsupported status value:', status);
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

    console.log('Update data:', updateData);

    // If nothing changed, return success without updating
    if (Object.keys(updateData).length === 0) {
      console.log('No changes detected, skipping update');
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
      console.error('Audit log error:', auditError);
      // Don't fail the request if audit logging fails
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Shipping info updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error updating shipping info:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
