import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { edgeLogger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Check Encryption Key Rotation
 * 
 * This function runs on a weekly cron schedule to check if encryption keys
 * need to be rotated according to the 90-day policy.
 * 
 * If keys haven't been rotated in 90+ days, it creates a high-severity
 * security event to alert administrators.
 * 
 * Schedule: Every Monday at 9:00 AM (see supabase/config.toml)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify cron secret for security
    const cronSecret = Deno.env.get('CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');
    
    if (!cronSecret || requestSecret !== cronSecret) {
      edgeLogger.error('Unauthorized key rotation check attempt', { hasSecret: !!requestSecret });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createAdminClient();

    edgeLogger.info('Checking encryption key rotation status');

    // Get the most recent encryption key
    const { data: keys, error: keysError } = await supabaseClient
      .from('encryption_keys')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (keysError) {
      edgeLogger.error('Error fetching encryption keys', keysError);
      throw keysError;
    }

    if (!keys || keys.length === 0) {
      edgeLogger.warn('No encryption keys found in database');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No encryption keys found' 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const mostRecentKey = keys[0];
    const lastRotationDate = new Date(mostRecentKey.rotated_at || mostRecentKey.created_at);
    const daysSinceRotation = Math.floor(
      (Date.now() - lastRotationDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    edgeLogger.info('Encryption key age calculated', { daysSinceRotation });

    // Check if rotation is needed (90+ days)
    if (daysSinceRotation >= 90) {
      edgeLogger.warn('Encryption key rotation OVERDUE', { daysOverdue: daysSinceRotation - 90 });

      // Create high-severity security event
      const { error: eventError } = await supabaseClient.from('security_events').insert({
        event_type: 'key_rotation_required',
        severity: 'high',
        details: {
          message: `Encryption keys have not been rotated in ${daysSinceRotation} days (90 day policy exceeded)`,
          last_rotation: lastRotationDate.toISOString(),
          days_overdue: daysSinceRotation - 90,
          key_name: mostRecentKey.key_name,
        },
      });

      if (eventError) {
        edgeLogger.error('Failed to create security event', eventError);
      } else {
        edgeLogger.info('Security event created for key rotation requirement');
      }

      // Also create an alert for immediate notification
      const { error: alertError } = await supabaseClient.functions.invoke('trigger-alert', {
        body: {
          event_type: 'key_rotation_required',
          severity: 'high',
          message: `Action Required: Encryption keys overdue for rotation (${daysSinceRotation} days since last rotation)`,
          details: {
            last_rotation: lastRotationDate.toISOString(),
            days_overdue: daysSinceRotation - 90,
          },
        },
      });

      if (alertError) {
        edgeLogger.error('Failed to trigger alert', alertError);
      } else {
        edgeLogger.info('Alert triggered for administrators');
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          rotation_required: true,
          days_since_rotation: daysSinceRotation,
          message: `Encryption key rotation is ${daysSinceRotation - 90} days overdue`
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Rotation not yet required
    const daysUntilRotation = 90 - daysSinceRotation;
    edgeLogger.info('Encryption keys are up to date', { daysUntilRotation });

    return new Response(
      JSON.stringify({ 
        success: true, 
        rotation_required: false,
        days_since_rotation: daysSinceRotation,
        days_until_rotation: daysUntilRotation,
        message: `Encryption keys are current. Next rotation due in ${daysUntilRotation} days`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    edgeLogger.error('Error in check-key-rotation function', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
