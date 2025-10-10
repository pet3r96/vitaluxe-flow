import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateShippingRequest {
  orderLineId: string;
  trackingNumber?: string;
  carrier?: string;
  status?: string;
  changeDescription?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { orderLineId, trackingNumber, carrier, status, changeDescription }: UpdateShippingRequest = await req.json();

    // Get current order line data
    const { data: currentLine, error: fetchError } = await supabase
      .from('order_lines')
      .select('tracking_number, shipping_carrier, status')
      .eq('id', orderLineId)
      .single();

    if (fetchError) throw fetchError;

    // Prepare update object
    const updateData: any = {};
    if (trackingNumber !== undefined) updateData.tracking_number = trackingNumber;
    if (carrier !== undefined) updateData.shipping_carrier = carrier;
    if (status !== undefined) {
      updateData.status = status;
      // Update timestamps based on status
      if (status === 'shipped' && currentLine.status !== 'shipped') {
        updateData.shipped_at = new Date().toISOString();
      }
      if (status === 'filled' && currentLine.status !== 'filled') {
        updateData.processing_at = new Date().toISOString();
      }
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
        new_status: status,
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
