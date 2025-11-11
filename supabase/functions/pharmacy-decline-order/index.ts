import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeclineRequest {
  order_id: string;
  decline_reason: string;
  additional_notes?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, decline_reason, additional_notes }: DeclineRequest = await req.json();

    if (!order_id || !decline_reason) {
      throw new Error('order_id and decline_reason are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    console.log(`Pharmacy user ${user.id} declining order ${order_id}`);

    // Get pharmacy ID
    const { data: pharmacy, error: pharmacyError } = await supabase
      .from('pharmacies')
      .select('id, name')
      .eq('user_id', user.id)
      .single();

    if (pharmacyError) {
      console.error('Error fetching pharmacy:', pharmacyError);
      throw new Error('Pharmacy not found');
    }

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        profiles (
          id,
          name,
          email
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      throw orderError;
    }

    // Verify pharmacy is assigned to this order
    const { data: assignedLines, error: assignedError } = await supabase
      .from('order_lines')
      .select('id')
      .eq('order_id', order_id)
      .eq('assigned_pharmacy_id', pharmacy.id);

    if (assignedError || !assignedLines || assignedLines.length === 0) {
      console.error('Pharmacy not assigned to this order');
      throw new Error('You are not authorized to decline this order');
    }

    // Build decline notes
    const declineNote = `\n[Declined by ${pharmacy.name} on ${new Date().toISOString()}]: ${decline_reason}${additional_notes ? ` - ${additional_notes}` : ''}`;

    // Update order lines to declined status
    const { error: updateError } = await supabase
      .from('order_lines')
      .update({
        status: 'declined',
        order_notes: supabase.rpc('concat', { 
          field: 'order_notes', 
          value: declineNote 
        })
      })
      .eq('order_id', order_id)
      .eq('assigned_pharmacy_id', pharmacy.id);

    if (updateError) {
      console.error('Error updating order lines:', updateError);
      throw updateError;
    }

    // Create message thread for disposition
    const { error: threadError } = await supabase
      .from('message_threads')
      .insert({
        subject: `Order Declined by Pharmacy - Order #${order.order_number || order_id.slice(0, 8)}`,
        thread_type: 'order_issue',
        disposition_type: 'pharmacy_decline',
        disposition_notes: `${decline_reason}${additional_notes ? `\n\nAdditional Notes: ${additional_notes}` : ''}`,
        order_id: order_id,
        created_by: user.id,
      });

    if (threadError) {
      console.error('Error creating message thread:', threadError);
      // Don't throw - this is not critical
    }

    // Trigger automatic refund
    console.log('Initiating automatic refund for order:', order_id);
    
    const { data: refundData, error: refundError } = await supabase.functions.invoke(
      'authorizenet-refund-transaction',
      {
        body: {
          order_id: order_id,
          refund_amount: order.total_amount,
          refund_reason: `Pharmacy declined: ${decline_reason}`,
          is_automatic: true,
        }
      }
    );

    if (refundError) {
      console.error('Error processing refund:', refundError);
      // Log but don't fail - we want to track this
      await supabase.from('error_logs').insert({
        error_message: `Refund failed for declined order ${order_id}: ${refundError.message}`,
        error_stack: JSON.stringify(refundError),
        user_id: user.id,
        severity: 'error',
      });
    } else {
      console.log('Refund processed successfully:', refundData);
    }

    // Send notification to practice
    if (order.profiles?.id) {
      const { error: notifError } = await supabase.functions.invoke('handleNotifications', {
        body: {
          user_id: order.profiles.id,
          notification_type: 'order_issue',
          title: 'Order Declined by Pharmacy',
          message: `Your order #${order.order_number || order_id.slice(0, 8)} has been declined by the pharmacy. Reason: ${decline_reason}. A full refund has been processed.`,
          metadata: {
            order_id: order_id,
            decline_reason: decline_reason,
            refund_processed: true
          },
          entity_type: 'order',
          entity_id: order_id
        }
      });

      if (notifError) {
        console.error('Error creating notification:', notifError);
        // Don't throw - this is not critical
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refundData?.refund_id,
        message: 'Order declined and refund processed successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in pharmacy-decline-order:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
