import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, createAuthClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';

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

  const startTime = Date.now();
  const ipAddress = getClientIP(req);

  try {
    const supabase = createAuthClient(req.headers.get('Authorization'));
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // PHASE 3: Rate limiting (30 requests/hour)
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      user.id,
      'pharmacy-decline-order',
      { maxRequests: 30, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { userId: user.id, function: 'pharmacy-decline-order' });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { order_id, decline_reason, additional_notes }: DeclineRequest = await req.json();

    if (!order_id || !decline_reason) {
      throw new Error('order_id and decline_reason are required');
    }

    // PHASE 3: ID validation
    const { valid: ownsResource, error: idError } = await validateUserOwnsResource(
      supabaseAdmin,
      user.id,
      'order',
      order_id
    );

    if (!ownsResource) {
      edgeLogger.error('ID validation failed', undefined, { error: idError, userId: user.id, orderId: order_id });
      return new Response(
        JSON.stringify({ error: idError || 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('Pharmacy user declining order', { userId: user.id, orderId: order_id });

    // Get pharmacy ID
    const { data: pharmacy, error: pharmacyError } = await supabase
      .from('pharmacies')
      .select('id, name')
      .eq('user_id', user.id)
      .single();

    if (pharmacyError) {
      edgeLogger.error('Error fetching pharmacy', pharmacyError);
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
      edgeLogger.error('Error fetching order', orderError);
      throw orderError;
    }

    // Verify pharmacy is assigned to this order
    const { data: assignedLines, error: assignedError } = await supabase
      .from('order_lines')
      .select('id')
      .eq('order_id', order_id)
      .eq('assigned_pharmacy_id', pharmacy.id);

    if (assignedError || !assignedLines || assignedLines.length === 0) {
      edgeLogger.error('Pharmacy not assigned to this order');
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
      edgeLogger.error('Error updating order lines', updateError);
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
      edgeLogger.error('Error creating message thread', threadError);
      // Don't throw - this is not critical
    }

    // Trigger automatic refund
    edgeLogger.info('Initiating automatic refund for order', { orderId: order_id });
    
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
      edgeLogger.error('Error processing refund', refundError);
      // Log but don't fail - we want to track this
      await supabase.from('error_logs').insert({
        error_message: `Refund failed for declined order ${order_id}: ${refundError.message}`,
        error_stack: JSON.stringify(refundError),
        user_id: user.id,
        severity: 'error',
      });
    } else {
      edgeLogger.info('Refund processed successfully', refundData);
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
        edgeLogger.error('Error creating notification', notifError);
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
    edgeLogger.error('Error in pharmacy-decline-order', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
