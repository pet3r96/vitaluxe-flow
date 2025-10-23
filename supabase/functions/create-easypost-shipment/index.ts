import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { createEasyPostClient, formatAddressForEasyPost, createDefaultParcel } from "../_shared/easypostClient.ts";
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

interface CreateShipmentRequest {
  order_line_id: string;
  from_address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    name?: string;
    company?: string;
  };
  to_address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    name?: string;
    company?: string;
  };
  parcel?: {
    length: number;
    width: number;
    height: number;
    weight: number;
  };
  carrier_accounts?: string[];
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse JSON with error handling
    let requestData: CreateShipmentRequest;
    try {
      requestData = await req.json();
    } catch (error) {
      console.error('Invalid JSON in request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!requestData.order_line_id) {
      return new Response(
        JSON.stringify({ error: 'order_line_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!requestData.from_address || !requestData.to_address) {
      return new Response(
        JSON.stringify({ error: 'from_address and to_address are required' }),
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
      throw new Error('Insufficient permissions - only admin and pharmacy users can create shipments');
    }

    // Get order line details
    const { data: orderLine, error: orderLineError } = await supabase
      .from('order_lines')
      .select(`
        id,
        order_id,
        product_id,
        patient_name,
        patient_address,
        assigned_pharmacy_id,
        status,
        tracking_number,
        easypost_shipment_id
      `)
      .eq('id', requestData.order_line_id)
      .single();

    if (orderLineError) {
      throw new Error(`Order line not found: ${orderLineError.message}`);
    }

    // Check if shipment already exists
    if (orderLine.easypost_shipment_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Shipment already exists for this order line',
          shipment_id: orderLine.easypost_shipment_id
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create EasyPost client
    const easyPostClient = createEasyPostClient();

    // Format addresses for EasyPost
    const fromAddress = formatAddressForEasyPost(
      requestData.from_address.street,
      requestData.from_address.city,
      requestData.from_address.state,
      requestData.from_address.zip
    );

    const toAddress = formatAddressForEasyPost(
      requestData.to_address.street,
      requestData.to_address.city,
      requestData.to_address.state,
      requestData.to_address.zip
    );

    // Add name and company if provided
    if (requestData.from_address.name) {
      fromAddress.name = requestData.from_address.name;
    }
    if (requestData.from_address.company) {
      fromAddress.company = requestData.from_address.company;
    }
    if (requestData.to_address.name) {
      toAddress.name = requestData.to_address.name;
    }
    if (requestData.to_address.company) {
      toAddress.company = requestData.to_address.company;
    }

    // Use provided parcel or default
    const parcel = requestData.parcel || createDefaultParcel();

    console.log('Creating shipment for order line:', requestData.order_line_id);

    // Create shipment with EasyPost
    const shipment = await easyPostClient.createShipment(
      fromAddress,
      toAddress,
      parcel,
      requestData.carrier_accounts
    );

    console.log('Shipment created:', shipment.id);

    // Store shipment in database
    const { data: dbShipment, error: dbError } = await supabase
      .from('easypost_shipments')
      .insert({
        easypost_shipment_id: shipment.id,
        order_line_id: requestData.order_line_id,
        tracking_code: shipment.tracking_code,
        carrier: shipment.carrier,
        service: shipment.service,
        status: shipment.status,
        label_url: shipment.label_url,
        tracking_url: shipment.tracking_url,
        rate: shipment.rate
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error storing shipment:', dbError);
      throw new Error(`Failed to store shipment: ${dbError.message}`);
    }

    // Update order line with tracking information
    const { error: updateError } = await supabase
      .from('order_lines')
      .update({
        tracking_number: shipment.tracking_code,
        shipping_carrier: shipment.carrier,
        easypost_shipment_id: shipment.id,
        status: 'shipped',
        shipped_at: new Date().toISOString()
      })
      .eq('id', requestData.order_line_id);

    if (updateError) {
      console.error('Error updating order line:', updateError);
      // Don't fail the request, but log the error
    }

    // Create audit log
    const { error: auditError } = await supabase
      .from('shipping_audit_logs')
      .insert({
        order_line_id: requestData.order_line_id,
        updated_by: user.id,
        updated_by_role: userRole,
        old_tracking_number: orderLine.tracking_number,
        new_tracking_number: shipment.tracking_code,
        old_carrier: orderLine.tracking_number ? 'unknown' : null,
        new_carrier: shipment.carrier,
        old_status: orderLine.status,
        new_status: 'shipped',
        change_description: 'EasyPost shipment created'
      });

    if (auditError) {
      console.error('Audit log error:', auditError);
      // Don't fail the request if audit logging fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        shipment: {
          id: shipment.id,
          tracking_code: shipment.tracking_code,
          carrier: shipment.carrier,
          service: shipment.service,
          status: shipment.status,
          label_url: shipment.label_url,
          tracking_url: shipment.tracking_url,
          rate: shipment.rate
        },
        message: 'Shipment created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error creating shipment:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to create shipment',
        details: error.details || null
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
