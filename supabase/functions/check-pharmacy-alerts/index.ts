import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertCheckRequest {
  pharmacy_id: string;
  check_types?: ('consecutive_failures' | 'high_failure_rate')[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();

    const { pharmacy_id, check_types = ['consecutive_failures', 'high_failure_rate'] }: AlertCheckRequest = await req.json();

    if (!pharmacy_id) {
      return new Response(JSON.stringify({ error: 'pharmacy_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const alertsCreated = [];

    // Check for 3+ consecutive failures
    if (check_types.includes('consecutive_failures')) {
      const { data: recentTransmissions } = await supabase
        .from('pharmacy_order_transmissions')
        .select('id, success, error_message, transmitted_at')
        .eq('pharmacy_id', pharmacy_id)
        .order('transmitted_at', { ascending: false })
        .limit(3);

      if (recentTransmissions && recentTransmissions.length === 3) {
        const allFailed = recentTransmissions.every(t => !t.success);

        if (allFailed) {
          // Check if unresolved alert already exists
          const { data: existingAlert } = await supabase
            .from('admin_alerts')
            .select('id')
            .eq('pharmacy_id', pharmacy_id)
            .eq('alert_type', 'pharmacy_api_down')
            .eq('resolved', false)
            .single();

          if (!existingAlert) {
            const { data: pharmacy } = await supabase
              .from('pharmacies')
              .select('name, api_endpoint_url')
              .eq('id', pharmacy_id)
              .single();

            const { data: newAlert, error: alertError } = await supabase
              .from('admin_alerts')
              .insert({
                alert_type: 'pharmacy_api_down',
                severity: 'critical',
                pharmacy_id,
                title: `Pharmacy API Down: ${pharmacy?.name || 'Unknown'}`,
                message: `The API for ${pharmacy?.name || 'this pharmacy'} has failed 3 consecutive times. Last error: ${recentTransmissions[0].error_message || 'Unknown error'}`,
                metadata: {
                  consecutive_failures: 3,
                  last_error: recentTransmissions[0].error_message,
                  last_transmission_ids: recentTransmissions.map(t => t.id),
                  endpoint: pharmacy?.api_endpoint_url
                }
              })
              .select()
              .single();

            if (!alertError && newAlert) {
              alertsCreated.push(newAlert);
            }
          }
        } else {
          // At least one success - auto-resolve any existing alert
          const { data: existingAlert } = await supabase
            .from('admin_alerts')
            .select('id')
            .eq('pharmacy_id', pharmacy_id)
            .eq('alert_type', 'pharmacy_api_down')
            .eq('resolved', false)
            .single();

          if (existingAlert) {
            await supabase
              .from('admin_alerts')
              .update({
                resolved: true,
                resolved_at: new Date().toISOString(),
                metadata: {
                  auto_resolved: true,
                  reason: 'Successful transmission received'
                }
              })
              .eq('id', existingAlert.id);
          }
        }
      }
    }

    // Check for high failure rate (>50% in last hour)
    if (check_types.includes('high_failure_rate')) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: hourlyTransmissions } = await supabase
        .from('pharmacy_order_transmissions')
        .select('id, success')
        .eq('pharmacy_id', pharmacy_id)
        .gte('transmitted_at', oneHourAgo);

      if (hourlyTransmissions && hourlyTransmissions.length >= 5) {
        const failedCount = hourlyTransmissions.filter(t => !t.success).length;
        const totalCount = hourlyTransmissions.length;
        const failureRate = failedCount / totalCount;

        if (failureRate > 0.5) {
          // Check if unresolved alert already exists
          const { data: existingAlert } = await supabase
            .from('admin_alerts')
            .select('id')
            .eq('pharmacy_id', pharmacy_id)
            .eq('alert_type', 'high_failure_rate')
            .eq('resolved', false)
            .single();

          if (!existingAlert) {
            const { data: pharmacy } = await supabase
              .from('pharmacies')
              .select('name')
              .eq('id', pharmacy_id)
              .single();

            const { data: newAlert, error: alertError } = await supabase
              .from('admin_alerts')
              .insert({
                alert_type: 'high_failure_rate',
                severity: 'warning',
                pharmacy_id,
                title: `High Failure Rate: ${pharmacy?.name || 'Unknown'}`,
                message: `${failedCount} of ${totalCount} transmissions (${Math.round(failureRate * 100)}%) failed in the last hour for ${pharmacy?.name || 'this pharmacy'}.`,
                metadata: {
                  failure_rate: failureRate,
                  failed_count: failedCount,
                  total_count: totalCount,
                  time_window: '1 hour'
                }
              })
              .select()
              .single();

            if (!alertError && newAlert) {
              alertsCreated.push(newAlert);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      alerts_created: alertsCreated.length,
      alerts: alertsCreated
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in check-pharmacy-alerts:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
