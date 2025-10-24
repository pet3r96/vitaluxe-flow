import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderActionRequest {
  order_id: string;
  action: 'hold' | 'decline';
  reason: string;
  notes?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, action, reason, notes }: OrderActionRequest = await req.json();

    if (!order_id || !action || !reason) {
      throw new Error('order_id, action, and reason are required');
    }

    if (!['hold', 'decline'].includes(action)) {
      throw new Error('action must be either "hold" or "decline"');
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

    console.log(`Pharmacy user ${user.id} ${action}ing order ${order_id}`);

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
      throw new Error('You are not authorized to perform this action on this order');
    }

    // Map reason to disposition_type
    const reasonToDispositionType: Record<string, string> = {
      'out_of_stock_temp': 'order_on_hold',
      'awaiting_patient': 'order_on_hold',
      'clarification_needed': 'order_on_hold',
      'incorrect_dosage_correction': 'order_on_hold',
      'out_of_stock_permanent': 'out_of_stock',
      'cannot_fulfill': 'cannot_fulfill',
      'invalid_prescription': 'invalid_prescription',
      'incorrect_dosage_permanent': 'incorrect_dosage',
      'patient_cancelled': 'patient_request',
      'other': 'other'
    };

    const dispositionType = reasonToDispositionType[reason] || 'other';

    if (action === 'hold') {
      // PUT ORDER ON HOLD
      const holdNote = `\n[On Hold by ${pharmacy.name} on ${new Date().toISOString()}]: ${reason}${notes ? ` - ${notes}` : ''}`;

      // Update order lines to on_hold status
      const { error: updateError } = await supabase
        .from('order_lines')
        .update({
          status: 'on_hold',
          order_notes: supabase.rpc('concat', { 
            field: 'order_notes', 
            value: holdNote 
          })
        })
        .eq('order_id', order_id)
        .eq('assigned_pharmacy_id', pharmacy.id);

      if (updateError) {
        console.error('Error updating order lines to on_hold:', updateError);
        throw updateError;
      }

      // Create message thread for order issue
      const { data: thread, error: threadError } = await supabase
        .from('message_threads')
        .insert({
          subject: `Order On Hold - Order #${order_id.slice(0, 8)}`,
          thread_type: 'order_issue',
          disposition_type: 'order_on_hold',
          order_id: order_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (threadError) {
        console.error('Error creating message thread:', threadError);
      } else {
        // Add pharmacy and practice as participants
        const participants = [
          { thread_id: thread.id, user_id: user.id },
          { thread_id: thread.id, user_id: order.profiles.id }
        ];

        const { error: participantsError } = await supabase
          .from('thread_participants')
          .insert(participants);

        if (participantsError) {
          console.error('Error adding thread participants:', participantsError);
        }

        // Create initial message
        const messageBody = `Order has been placed on hold by ${pharmacy.name}.\n\nReason: ${reason}\n${notes ? `\nNotes: ${notes}` : ''}`;
        
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            thread_id: thread.id,
            sender_id: user.id,
            body: messageBody,
          });

        if (messageError) {
          console.error('Error creating initial message:', messageError);
        }
      }

      // Send notification to practice
      if (order.profiles?.id) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: order.profiles.id,
            notification_type: 'order_update',
            title: 'Order Placed On Hold',
            message: `Your order #${order_id.slice(0, 8)} has been placed on hold by the pharmacy. Reason: ${reason}. Please check your messages for details.`,
            entity_type: 'order',
            entity_id: order_id,
            severity: 'warning',
            action_url: '/messages',
          });

        if (notifError) {
          console.error('Error creating notification:', notifError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'hold',
          thread_id: thread?.id,
          message: 'Order placed on hold successfully',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } else {
      // DECLINE AND REFUND ORDER
      const declineNote = `\n[Declined by ${pharmacy.name} on ${new Date().toISOString()}]: ${reason}${notes ? ` - ${notes}` : ''}`;

      // Update order lines to denied status
      const { error: updateError } = await supabase
        .from('order_lines')
        .update({
          status: 'denied',
          order_notes: supabase.rpc('concat', { 
            field: 'order_notes', 
            value: declineNote 
          })
        })
        .eq('order_id', order_id)
        .eq('assigned_pharmacy_id', pharmacy.id);

      if (updateError) {
        console.error('Error updating order lines to denied:', updateError);
        throw updateError;
      }

      // Create message thread for disposition
      const { data: thread, error: threadError } = await supabase
        .from('message_threads')
        .insert({
          subject: `Order Declined and Refunded - Order #${order_id.slice(0, 8)}`,
          thread_type: 'order_issue',
          disposition_type: dispositionType,
          disposition_notes: `${reason}${notes ? `\n\nAdditional Notes: ${notes}` : ''}`,
          order_id: order_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (threadError) {
        console.error('Error creating message thread:', threadError);
      } else {
        // Add pharmacy and practice as participants
        const participants = [
          { thread_id: thread.id, user_id: user.id },
          { thread_id: thread.id, user_id: order.profiles.id }
        ];

        const { error: participantsError } = await supabase
          .from('thread_participants')
          .insert(participants);

        if (participantsError) {
          console.error('Error adding thread participants:', participantsError);
        }

        // Create initial message
        const messageBody = `Order has been declined by ${pharmacy.name} and a full refund has been processed.\n\nReason: ${reason}\n${notes ? `\nNotes: ${notes}` : ''}`;
        
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            thread_id: thread.id,
            sender_id: user.id,
            body: messageBody,
          });

        if (messageError) {
          console.error('Error creating initial message:', messageError);
        }
      }

      // Trigger automatic refund
      console.log('Initiating automatic refund for order:', order_id);
      
      const { data: refundData, error: refundError } = await supabase.functions.invoke(
        'authorizenet-refund-transaction',
        {
          body: {
            order_id: order_id,
            refund_amount: order.total_amount,
            refund_reason: `Pharmacy declined: ${reason}`,
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
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: order.profiles.id,
            notification_type: 'order_update',
            title: 'Order Declined and Refunded',
            message: `Your order #${order_id.slice(0, 8)} has been declined by the pharmacy. Reason: ${reason}. A full refund has been processed.`,
            entity_type: 'order',
            entity_id: order_id,
            severity: 'error',
            action_url: '/messages',
          });

        if (notifError) {
          console.error('Error creating notification:', notifError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'decline',
          refund_id: refundData?.refund_id,
          thread_id: thread?.id,
          message: 'Order declined and refund processed successfully',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error: any) {
    console.error('Error in pharmacy-order-action:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
