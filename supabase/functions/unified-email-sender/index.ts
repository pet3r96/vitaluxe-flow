import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailPayload {
  type: 'transactional' | 'notification';
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  
  // For notifications only
  userId?: string;
  eventType?: string;
  
  // Correlation tracking
  correlationId?: string;
  
  // Idempotency
  idempotencyKey?: string;
  entityId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  
  // Import logger at top of function
  const { edgeLogger } = await import('../_shared/logger.ts');
  edgeLogger.info('Request received', { correlationId });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const payload: EmailPayload = await req.json();
    payload.correlationId = payload.correlationId || correlationId;

    edgeLogger.info('Processing email', { correlationId: payload.correlationId, type: payload.type });

    // Check idempotency - prevent duplicate sends
    if (payload.eventType && payload.entityId) {
      const { data: existingSend } = await supabaseAdmin
        .from('notifications_sent')
        .select('id')
        .eq('event_type', payload.eventType)
        .eq('entity_id', payload.entityId)
        .eq('recipient', payload.to)
        .maybeSingle();

      if (existingSend) {
        edgeLogger.info('Duplicate email prevented', { correlationId: payload.correlationId, eventType: payload.eventType, entityId: payload.entityId });
        return new Response(
          JSON.stringify({ 
            success: true, 
            skipped: true,
            reason: 'already_sent',
            correlationId: payload.correlationId 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate placeholder email
    if (isPlaceholderEmail(payload.to)) {
      edgeLogger.error('Blocked placeholder email', undefined, { correlationId: payload.correlationId });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Cannot send to placeholder email',
          correlationId: payload.correlationId 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For notifications, check user preferences
    if (payload.type === 'notification') {
      if (!payload.userId || !payload.eventType) {
        edgeLogger.error('Missing required notification fields', undefined, { correlationId: payload.correlationId });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'userId and eventType required for notifications',
            correlationId: payload.correlationId 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Query user preferences
      const { data: preference, error: prefError } = await supabaseAdmin
        .from('notification_preferences')
        .select('email_enabled')
        .eq('user_id', payload.userId)
        .eq('event_type', payload.eventType)
        .maybeSingle();

      if (prefError) {
        edgeLogger.error('Error fetching preferences', prefError, { correlationId: payload.correlationId });
      }

      // Default to enabled if no preference exists
      const emailEnabled = preference?.email_enabled ?? true;

      if (!emailEnabled) {
        edgeLogger.info('User disabled email notifications', { correlationId: payload.correlationId, eventType: payload.eventType });
        
        // Log as skipped
        await logNotification(supabaseAdmin, {
          userId: payload.userId,
          channel: 'email',
          status: 'skipped',
          correlationId: payload.correlationId,
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            skipped: true,
            reason: 'user_disabled',
            correlationId: payload.correlationId 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Send via Postmark with retry logic
    let attempt = 0;
    const maxAttempts = 3;
    let lastError: any = null;
    let success = false;
    let messageId: string | null = null;

    while (attempt < maxAttempts && !success) {
      attempt++;
      edgeLogger.info('Email send attempt', { correlationId: payload.correlationId, attempt, maxAttempts });

      try {
        const result = await sendViaPostmark({
          to: payload.to,
          subject: payload.subject,
          htmlBody: payload.htmlBody,
          textBody: payload.textBody,
        });

        messageId = result.MessageID;
        success = true;
        edgeLogger.info('Email sent successfully', { correlationId: payload.correlationId, messageId, attempt });
        
      } catch (error: any) {
        lastError = error;
        edgeLogger.error('Email send attempt failed', error, { correlationId: payload.correlationId, attempt });
        
        if (attempt < maxAttempts) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          edgeLogger.info('Retrying email send', { correlationId: payload.correlationId, backoffMs });
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // Log to audit_logs
    await supabaseAdmin.from('audit_logs').insert({
      action_type: `email_${payload.type}`,
      user_id: payload.userId || null,
      user_email: payload.to,
      entity_type: 'email',
      entity_id: messageId,
      details: {
        success,
        attempts: attempt,
        correlationId: payload.correlationId,
        eventType: payload.eventType,
        error: success ? null : lastError?.message,
      }
    });

    // Log notification delivery if notification type
    if (payload.type === 'notification' && payload.userId) {
      await logNotification(supabaseAdmin, {
        userId: payload.userId,
        channel: 'email',
        status: success ? 'sent' : 'failed',
        externalId: messageId || undefined,
        errorMessage: success ? undefined : lastError?.message,
        correlationId: payload.correlationId,
      });
    }

    if (success) {
      // Record successful send for idempotency
      if (payload.eventType && payload.entityId) {
        await supabaseAdmin
          .from('notifications_sent')
          .upsert({
            event_type: payload.eventType,
            entity_id: payload.entityId,
            recipient: payload.to,
            message_id: messageId || undefined,
            metadata: {
              correlationId: payload.correlationId,
              attempts: attempt,
              subject: payload.subject,
            }
          }, {
            onConflict: 'event_type,entity_id,recipient'
          });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId, 
          correlationId: payload.correlationId,
          attempts: attempt 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw lastError || new Error('All retry attempts failed');
    }

  } catch (error: any) {
    const { edgeLogger } = await import('../_shared/logger.ts');
    edgeLogger.error('Fatal error in unified-email-sender', error, { correlationId });
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        correlationId 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Check if email is placeholder
function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return /^no-email-[a-f0-9-]+@pending\.local$/i.test(email);
}

// Helper: Send via Postmark
async function sendViaPostmark(params: {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}): Promise<{ MessageID: string }> {
  const POSTMARK_API_KEY = Deno.env.get("POSTMARK_API_KEY");
  const POSTMARK_FROM_EMAIL = Deno.env.get("POSTMARK_FROM_EMAIL") || "info@vitaluxeservices.com";

  if (!POSTMARK_API_KEY) {
    throw new Error("POSTMARK_API_KEY not configured");
  }

  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": POSTMARK_API_KEY,
    },
    body: JSON.stringify({
      From: POSTMARK_FROM_EMAIL,
      To: params.to,
      Subject: params.subject,
      HtmlBody: params.htmlBody,
      TextBody: params.textBody,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Postmark API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

// Helper: Log notification delivery
async function logNotification(supabaseClient: any, params: {
  userId: string;
  channel: 'email' | 'sms' | 'in_app';
  status: 'sent' | 'failed' | 'skipped';
  externalId?: string;
  errorMessage?: string;
  correlationId?: string;
}): Promise<void> {
  try {
    const { error } = await supabaseClient
      .from('notification_logs')
      .insert({
        notification_id: null, // Can be linked later if needed
        user_id: params.userId,
        channel: params.channel,
        status: params.status,
        external_id: params.externalId,
        error_message: params.errorMessage,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      const { edgeLogger } = await import('../_shared/logger.ts');
      edgeLogger.error('Failed to log delivery', error, { channel: params.channel });
    }
  } catch (error) {
    const { edgeLogger } = await import('../_shared/logger.ts');
    edgeLogger.error('Exception logging delivery', error);
  }
}
