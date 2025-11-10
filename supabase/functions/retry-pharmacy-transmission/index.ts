import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RetryRequest {
  transmission_ids: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleCheck } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { transmission_ids }: RetryRequest = await req.json();

    if (!transmission_ids || !Array.isArray(transmission_ids) || transmission_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid transmission_ids' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch failed transmissions
    const { data: transmissions, error: fetchError } = await supabase
      .from('pharmacy_order_transmissions')
      .select(`
        *,
        pharmacies (
          id, name, api_enabled, api_endpoint_url, api_auth_type,
          retry_count, timeout_seconds
        )
      `)
      .in('id', transmission_ids)
      .eq('success', false);

    if (fetchError) {
      console.error('Error fetching transmissions:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch transmissions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = {
      successful: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    };

    for (const transmission of transmissions || []) {
      const pharmacy = transmission.pharmacies as any;

      // Skip if pharmacy API is disabled or config changed
      if (!pharmacy || !pharmacy.api_enabled || !pharmacy.api_endpoint_url) {
        results.skipped++;
        results.details.push({
          transmission_id: transmission.id,
          order_number: transmission.order_number,
          status: 'skipped',
          reason: 'Pharmacy API disabled or endpoint missing'
        });
        continue;
      }

      // Fetch current order data
      const { data: order } = await supabase
        .from('orders')
        .select('*, order_lines(*)')
        .eq('id', transmission.order_id)
        .single();

      if (!order) {
        results.skipped++;
        results.details.push({
          transmission_id: transmission.id,
          order_number: transmission.order_number,
          status: 'skipped',
          reason: 'Order not found'
        });
        continue;
      }

      // Fetch API credentials
      const { data: credentials } = await supabase
        .from('pharmacy_api_credentials')
        .select('*')
        .eq('pharmacy_id', pharmacy.id)
        .single();

      // Build headers based on auth type
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Handle BareMeds OAuth separately
      if (pharmacy.api_auth_type === 'baremeds') {
        console.log('Fetching BareMeds token for retry...');
        try {
          const tokenResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/baremeds-get-token`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              },
              body: JSON.stringify({ pharmacy_id: pharmacy.id })
            }
          );

          if (!tokenResponse.ok) {
            throw new Error(`Failed to get BareMeds token: ${await tokenResponse.text()}`);
          }

          const tokenData = await tokenResponse.json();
          headers['Authorization'] = `Bearer ${tokenData.token}`;
          console.log(`Got BareMeds token for retry`);
        } catch (error: any) {
          console.error('BareMeds token fetch error:', error);
          results.failed++;
          results.details.push({
            transmission_id: transmission.id,
            order_number: transmission.order_number,
            status: 'failed',
            error: `BareMeds auth failed: ${error.message}`
          });
          continue;
        }
      } else if (pharmacy.api_auth_type === 'bearer' && credentials?.api_token) {
        headers['Authorization'] = `Bearer ${credentials.api_token}`;
      } else if (pharmacy.api_auth_type === 'api_key' && credentials?.api_key) {
        headers['X-API-Key'] = credentials.api_key;
      } else if (pharmacy.api_auth_type === 'basic' && credentials?.api_username && credentials?.api_password) {
        const basicAuth = btoa(`${credentials.api_username}:${credentials.api_password}`);
        headers['Authorization'] = `Basic ${basicAuth}`;
      }

      // Build payload
      const payload = {
        order_id: order.id,
        order_number: order.order_number,
        transmission_type: transmission.transmission_type,
        request_body: transmission.request_body
      };

      // Attempt transmission with retry logic
      const maxRetries = pharmacy.retry_count || 3;
      const timeout = (pharmacy.timeout_seconds || 30) * 1000;
      let lastError = '';
      let success = false;
      let responseBody = null;
      let statusCode = 0;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(pharmacy.api_endpoint_url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          statusCode = response.status;
          responseBody = await response.text();

          if (response.ok) {
            success = true;
            break;
          } else {
            lastError = `HTTP ${response.status}: ${responseBody}`;
          }
        } catch (error: any) {
          lastError = error.message || 'Unknown error';
          if (error.name === 'AbortError') {
            lastError = `Request timeout after ${timeout}ms`;
          }
        }

        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }

      // Create new transmission log entry
      const { error: logError } = await supabase
        .from('pharmacy_order_transmissions')
        .insert({
          pharmacy_id: pharmacy.id,
          order_id: order.id,
          order_line_id: transmission.order_line_id,
          order_number: order.order_number,
          transmission_type: transmission.transmission_type,
          request_body: payload,
          response_body: responseBody,
          success,
          error_message: success ? null : lastError,
          http_status_code: statusCode,
          retry_count: maxRetries,
          manually_retried: false,
          retried_at: null,
          retried_by: null
        });

      if (logError) {
        console.error('Error creating new transmission log:', logError);
      }

      // Mark original transmission as manually retried
      await supabase
        .from('pharmacy_order_transmissions')
        .update({
          manually_retried: true,
          retried_at: new Date().toISOString(),
          retried_by: user.id
        })
        .eq('id', transmission.id);

      if (success) {
        results.successful++;
        results.details.push({
          transmission_id: transmission.id,
          order_number: transmission.order_number,
          status: 'success',
          message: 'Transmission successful'
        });
      } else {
        results.failed++;
        results.details.push({
          transmission_id: transmission.id,
          order_number: transmission.order_number,
          status: 'failed',
          error: lastError
        });
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in retry-pharmacy-transmission:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
