import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { validateWebhookRequest } from '../_shared/requestValidators.ts';
import { validateAuthorizenetWebhookSignature, validateWebhookPayload } from '../_shared/webhookValidator.ts';
import { handleError, createErrorResponse } from '../_shared/errorHandler.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-anet-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Get webhook signature from headers
    const signature = req.headers.get('x-anet-signature');
    
    // Parse webhook payload
    const rawBody = await req.text();
    let payload: any;
    
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('Failed to parse webhook payload:', parseError);
      return createErrorResponse('Invalid JSON payload', 400, null, undefined, corsHeaders);
    }

    // Validate webhook payload structure
    const structureValidation = validateWebhookPayload(payload);
    if (!structureValidation.valid) {
      console.error('Invalid webhook structure:', structureValidation.errors);
      return createErrorResponse(
        'Invalid webhook payload structure',
        400,
        null,
        structureValidation.errors,
        corsHeaders
      );
    }

    // Validate webhook signature
    const signingKey = Deno.env.get('AUTHORIZENET_WEBHOOK_SIGNING_KEY');
    const signatureValidation = await validateAuthorizenetWebhookSignature(
      signature,
      rawBody,
      signingKey
    );
    
    if (!signatureValidation.valid) {
      console.error('Webhook signature validation failed:', signatureValidation.reason);
      
      // Log security event
      await supabase.rpc('log_audit_event', {
        p_action_type: 'webhook_signature_failed',
        p_entity_type: 'webhook',
        p_entity_id: null,
        p_details: {
          reason: signatureValidation.reason,
          has_signature: !!signature,
          event_type: payload.eventType,
        },
      });
      
      return createErrorResponse('Invalid webhook signature', 401, null, undefined, corsHeaders);
    }

    // Validate request data
    const validation = validateWebhookRequest(payload);
    if (!validation.valid) {
      console.error('Webhook validation failed:', validation.errors);
      return createErrorResponse(
        'Invalid webhook data',
        400,
        null,
        validation.errors,
        corsHeaders
      );
    }

    const { eventType, payload: webhookPayload } = payload;
    console.info(`Received Authorize.Net webhook: ${eventType}`);

    // Extract transaction ID safely
    const transactionId = webhookPayload?.id || webhookPayload?.authCode || null;

    // Handle different event types
    switch (eventType) {
      case 'net.authorize.payment.authcapture.created': {
        // Payment authorized and captured - mark order as paid
        if (transactionId) {
          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              payment_status: 'paid',
              transaction_id: transactionId,
              updated_at: new Date().toISOString()
            })
            .eq('transaction_id', transactionId);

          if (updateError) {
            console.error('Failed to update order payment status:', updateError.message);
          } else {
            console.info(`Order payment status updated for transaction ${transactionId}`);
          }
        }
        break;
      }

      case 'net.authorize.payment.refund.created': {
        // Payment refunded - handled by refund endpoint
        console.info(`Refund webhook received for transaction ${transactionId}`);
        break;
      }

      case 'net.authorize.payment.void.created': {
        // Payment voided
        if (transactionId) {
          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              payment_status: 'voided',
              updated_at: new Date().toISOString()
            })
            .eq('transaction_id', transactionId);

          if (updateError) {
            console.error('Failed to update order to voided:', updateError.message);
          } else {
            console.info(`Order voided for transaction ${transactionId}`);
          }
        }
        break;
      }

      default:
        console.info(`Unhandled webhook event type: ${eventType}`);
    }

    // Log webhook receipt to audit trail
    await supabase.rpc('log_audit_event', {
      p_action_type: 'webhook_received',
      p_entity_type: 'webhook',
      p_entity_id: transactionId,
      p_details: {
        event_type: eventType,
        transaction_id: transactionId,
        signature_valid: signatureValidation.valid,
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        event_type: eventType,
        processed: true
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    return handleError(
      supabase,
      error,
      'authorizenet-webhook',
      'external_api',
      corsHeaders,
      { webhook_source: 'authorize.net' }
    );
  }
});
