import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailPayload {
  type: 'verification' | 'welcome' | 'reset' | 'portal_access';
  userId: string;
  email: string;
  name?: string;
  practiceId?: string;
  correlationId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  console.log(`[email-dispatcher] ${correlationId} - Request received`);

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const payload: EmailPayload = await req.json();
    console.log(`[email-dispatcher] ${correlationId} - Type: ${payload.type}, User: ${payload.userId}`);

    let attempt = 0;
    const maxAttempts = 3;
    let lastError: any = null;
    let success = false;
    let messageId: string | null = null;

    // Retry logic with exponential backoff
    while (attempt < maxAttempts && !success) {
      attempt++;
      console.log(`[email-dispatcher] ${correlationId} - Attempt ${attempt}/${maxAttempts}`);

      try {
        let result;
        
        switch (payload.type) {
          case 'verification':
            result = await supabaseAdmin.functions.invoke('send-verification-email', {
              body: {
                userId: payload.userId,
                email: payload.email,
                name: payload.name,
              }
            });
            break;
            
          case 'welcome':
            result = await supabaseAdmin.functions.invoke('send-welcome-email', {
              body: {
                userId: payload.userId,
                email: payload.email,
                name: payload.name,
                practiceId: payload.practiceId,
              }
            });
            break;
            
          case 'reset':
            result = await supabaseAdmin.functions.invoke('send-password-reset-email', {
              body: {
                userId: payload.userId,
                email: payload.email,
              }
            });
            break;
            
          case 'portal_access':
            result = await supabaseAdmin.functions.invoke('send-welcome-email', {
              body: {
                userId: payload.userId,
                email: payload.email,
                name: payload.name,
                practiceId: payload.practiceId,
              }
            });
            break;
            
          default:
            throw new Error(`Unknown email type: ${payload.type}`);
        }

        if (result.error) {
          throw result.error;
        }

        messageId = result.data?.messageId || null;
        success = true;
        console.log(`[email-dispatcher] ${correlationId} - ✅ Success on attempt ${attempt}`);
        
      } catch (error: any) {
        lastError = error;
        console.error(`[email-dispatcher] ${correlationId} - ❌ Attempt ${attempt} failed:`, error);
        
        if (attempt < maxAttempts) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`[email-dispatcher] ${correlationId} - Retrying in ${backoffMs}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // Log to audit_logs
    await supabaseAdmin.from('audit_logs').insert({
      action_type: `email_${payload.type}`,
      user_id: payload.userId,
      user_email: payload.email,
      entity_type: 'email',
      entity_id: messageId,
      details: {
        success,
        attempts: attempt,
        correlationId,
        error: success ? null : lastError?.message,
      }
    });

    if (success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId, 
          correlationId,
          attempts: attempt 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw lastError || new Error('All retry attempts failed');
    }

  } catch (error: any) {
    console.error(`[email-dispatcher] ${correlationId} - Fatal error:`, error);
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
