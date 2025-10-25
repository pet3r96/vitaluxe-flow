import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { createEasyPostClient } from "../_shared/easypostClient.ts";
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

interface GetTrackingRequest {
  tracking_code?: string;
  order_line_id?: string;
  create_tracker?: boolean;
  carrier?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse JSON with error handling
    let requestData: GetTrackingRequest;
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
    if (!requestData.tracking_code && !requestData.order_line_id) {
      return new Response(
        JSON.stringify({ error: 'Either tracking_code or order_line_id is required' }),
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
    if (!userRole || !['admin', 'pharmacy', 'doctor'].includes(userRole)) {
      throw new Error('Insufficient permissions - only admin, pharmacy, and doctor users can view tracking');
    }

    let trackingCode = requestData.tracking_code;
    const orderLineId = requestData.order_line_id;

    // If order_line_id provided, get tracking code from database
    if (orderLineId && !trackingCode) {
      const { data: orderLine, error: orderLineError } = await supabase
        .from('order_lines')
        .select('tracking_number, easypost_shipment_id')
        .eq('id', orderLineId)
        .single();

      if (orderLineError) {
        throw new Error(`Order line not found: ${orderLineError.message}`);
      }

      if (!orderLine.tracking_number && !orderLine.easypost_shipment_id) {
        return new Response(
          JSON.stringify({ error: 'No tracking information available for this order line' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      trackingCode = orderLine.tracking_number;
    }

    if (!trackingCode) {
      return new Response(
        JSON.stringify({ error: 'No tracking code available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create EasyPost client
    const easyPostClient = createEasyPostClient();

    console.log('Getting tracking for:', trackingCode, requestData.carrier ? `with carrier: ${requestData.carrier}` : '(auto-detect carrier)');

    // Get tracking information from EasyPost with optional carrier
    const tracking = await easyPostClient.getTracking(trackingCode, requestData.carrier);

    // Store tracking events in database
    if (orderLineId && tracking.events.length > 0) {
      // Check if we already have recent events for this tracking code
      const { data: existingEvents } = await supabase
        .from('easypost_tracking_events')
        .select('id')
        .eq('order_line_id', orderLineId)
        .eq('easypost_tracker_id', trackingCode)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      // Only insert new events if we don't have recent ones
      if (!existingEvents || existingEvents.length === 0) {
        const eventsToInsert = tracking.events.map(event => ({
          easypost_tracker_id: trackingCode,
          order_line_id: orderLineId,
          status: event.status,
          message: event.message,
          description: event.description,
          carrier: event.carrier,
          tracking_details: event.tracking_details,
          event_time: event.datetime
        }));

        const { error: insertError } = await supabase
          .from('easypost_tracking_events')
          .insert(eventsToInsert);

        if (insertError) {
          console.error('Error storing tracking events:', insertError);
          // Don't fail the request if we can't store events
        }
      }
    }

    // Check if order should be marked as completed
    if (orderLineId && tracking.status === 'delivered') {
      const { error: updateError } = await supabase
        .from('order_lines')
        .update({
          status: 'completed',
          delivered_at: new Date().toISOString()
        })
        .eq('id', orderLineId);

      if (updateError) {
        console.error('Error updating order line status:', updateError);
        // Don't fail the request if we can't update status
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tracking: {
          status: tracking.status,
          tracking_url: tracking.tracking_url,
          events: tracking.events,
          carrier: tracking.carrier,
          est_delivery_date: tracking.est_delivery_date,
          signed_by: tracking.signed_by,
          weight: tracking.weight,
          carrier_detail: tracking.carrier_detail
        },
        message: 'Tracking information retrieved successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error getting tracking:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to get tracking information',
        details: error.details || null
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
