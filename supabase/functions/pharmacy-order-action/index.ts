import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, createAuthClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';
import { validateInput, pharmacyOrderActionSchema } from '../_shared/zodSchemas.ts';
import { validateRequestSize } from '../_shared/requestSizeValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderActionRequest {
  order_id: string;
  action: 'hold' | 'decline';
  reason: string;
  notes?: string;
  target_user_id?: string; // For admin impersonation
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // PHASE 3 SECURITY: Request size validation
  const sizeValidation = validateRequestSize(req, 'pharmacy-order-action', corsHeaders);
  if (sizeValidation) return sizeValidation;

  const startTime = Date.now();
  const ipAddress = getClientIP(req);

  try {
    const supabaseAdmin = createAdminClient();
    const supabase = createAuthClient(req.headers.get('Authorization'));

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      edgeLogger.logOperation({
        ip_address: ipAddress,
        operation: 'pharmacy-order-action',
        success: false,
        duration_ms: Date.now() - startTime,
        metadata: { error: 'Authentication failed' }
      });
      throw new Error('Unauthorized');
    }

    // PHASE 3: Rate limiting (50 requests/hour)
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      user.id,
      'pharmacy-order-action',
      { maxRequests: 50, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { userId: user.id, function: 'pharmacy-order-action' });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();

    // PHASE 3: Schema validation
    const validation = validateInput(pharmacyOrderActionSchema, body);
    if (!validation.success) {
      edgeLogger.warn('Validation failed', { errors: validation.errors });
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { order_id, action, reason, notes, target_user_id } = body as OrderActionRequest;

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

    if (!order_id || !action || !reason) {
      throw new Error('order_id, action, and reason are required');
    }

    if (!['hold', 'decline'].includes(action)) {
      throw new Error('action must be either "hold" or "decline"');
    }

    // Determine which user ID to use for pharmacy lookup
    let pharmacyUserId = user.id;

    // If target_user_id provided, verify admin permission
    if (target_user_id && target_user_id !== user.id) {
      edgeLogger.info('Admin acting as pharmacy user', { adminId: user.id, targetUserId: target_user_id });
      
      // Verify acting user is admin
      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (roleData?.role !== 'admin') {
        throw new Error('Only admins can act on behalf of other users');
      }
      
      pharmacyUserId = target_user_id;
    }

    edgeLogger.info('Pharmacy user action', { pharmacyUserId, action, orderId: order_id });

    // Get pharmacy ID using resolved user ID
    const { data: pharmacy, error: pharmacyError } = await supabaseAdmin
      .from('pharmacies')
      .select('id, name')
      .eq('user_id', pharmacyUserId)
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

      // Fetch current order lines to append notes
      const { data: currentLines, error: fetchError } = await supabaseAdmin
        .from('order_lines')
        .select('id, order_notes')
        .eq('order_id', order_id)
        .eq('assigned_pharmacy_id', pharmacy.id);

      if (fetchError) {
        edgeLogger.error('Error fetching order lines', fetchError);
        throw fetchError;
      }

      // Update each line individually with concatenated notes
      const updatePromises = (currentLines || []).map(line => {
        const updatedNotes = (line.order_notes || '') + holdNote;
        
        return supabaseAdmin
          .from('order_lines')
          .update({
            status: 'on_hold',
            order_notes: updatedNotes
          })
          .eq('id', line.id);
      });

      const results = await Promise.all(updatePromises);
      const updateError = results.find(r => r.error)?.error;

      if (updateError) {
        edgeLogger.error('Error updating order lines to on_hold', updateError);
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
        edgeLogger.error('Error creating message thread', threadError);
      } else {
        // Add pharmacy and practice as recipients to internal messaging system
        const recipients = [
          { message_id: thread.id, recipient_id: user.id },
          { message_id: thread.id, recipient_id: order.profiles.id }
        ];

        const { error: recipientsError } = await supabase
          .from('internal_message_recipients')
          .insert(recipients);

        if (recipientsError) {
          edgeLogger.error('Error adding message recipients', recipientsError);
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
          edgeLogger.error('Error creating initial message', messageError);
        }
      }

      // Send notification to practice
      if (order.profiles?.id) {
        const { error: notifError } = await supabase.functions.invoke('handleNotifications', {
          body: {
            user_id: order.profiles.id,
            notification_type: 'order_update',
            title: 'Order Placed On Hold',
            message: `Your order #${order_id.slice(0, 8)} has been placed on hold by the pharmacy. Reason: ${reason}. Please check your messages for details.`,
            action_url: '/messages',
            metadata: {
              order_id: order_id,
              reason: reason,
              thread_id: thread?.id
            },
            entity_type: 'order',
            entity_id: order_id
          }
        });

        if (notifError) {
          edgeLogger.error('Error creating notification', notifError);
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

      // Fetch current order lines to append notes
      const { data: currentLines, error: fetchError } = await supabaseAdmin
        .from('order_lines')
        .select('id, order_notes')
        .eq('order_id', order_id)
        .eq('assigned_pharmacy_id', pharmacy.id);

      if (fetchError) {
        edgeLogger.error('Error fetching order lines', fetchError);
        throw fetchError;
      }

      // Update each line individually with concatenated notes
      const updatePromises = (currentLines || []).map(line => {
        const updatedNotes = (line.order_notes || '') + declineNote;
        
        return supabaseAdmin
          .from('order_lines')
          .update({
            status: 'denied',
            order_notes: updatedNotes
          })
          .eq('id', line.id);
      });

      const results = await Promise.all(updatePromises);
      const updateError = results.find(r => r.error)?.error;

      if (updateError) {
        edgeLogger.error('Error updating order lines to denied', updateError);
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
        edgeLogger.error('Error creating message thread', threadError);
      } else {
        // Add pharmacy and practice as recipients
        const recipients = [
          { message_id: thread.id, recipient_id: user.id },
          { message_id: thread.id, recipient_id: order.profiles.id }
        ];

        const { error: recipientsError } = await supabase
          .from('internal_message_recipients')
          .insert(recipients);

        if (recipientsError) {
          edgeLogger.error('Error adding message recipients', recipientsError);
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
          edgeLogger.error('Error creating initial message', messageError);
        }
      }

      // Trigger automatic refund
      edgeLogger.info('Initiating automatic refund for order', { orderId: order_id });
      
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
            title: 'Order Declined and Refunded',
            message: `Your order #${order_id.slice(0, 8)} has been declined by the pharmacy. Reason: ${reason}. A full refund has been processed.`,
            action_url: '/messages',
            metadata: {
              order_id: order_id,
              reason: reason,
              refund_id: refundData?.refund_id,
              thread_id: thread?.id
            },
            entity_type: 'order',
            entity_id: order_id
          }
        });

        if (notifError) {
          edgeLogger.error('Error creating notification', notifError);
        }
      }

      // Log successful operation
      edgeLogger.logOperation({
        user_id: user.id,
        ip_address: ipAddress,
        operation: 'pharmacy-order-action',
        success: true,
        duration_ms: Date.now() - startTime,
        metadata: {
          action: 'decline',
          order_id,
          pharmacy_id: pharmacy.id,
          reason,
          refund_processed: true
        }
      });

      // Audit log for pharmacy decline with refund
      await supabaseAdmin.from('audit_logs').insert({
        action_type: 'pharmacy_order_routed',
        user_id: pharmacyUserId,
        entity_type: 'orders',
        entity_id: order_id,
        ip_address: ipAddress,
        details: {
          action: 'decline',
          pharmacy_name: pharmacy.name,
          reason,
          refund_id: refundData?.refund_id,
          timestamp: new Date().toISOString()
        }
      });

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
    edgeLogger.error('Error in pharmacy-order-action', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
