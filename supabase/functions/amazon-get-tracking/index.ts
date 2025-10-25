import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      throw new Error('Missing bearer token');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    console.log('Authenticated user:', user.id);

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabase, user.id, csrfToken);
    if (!valid) {
      console.error('CSRF validation failed:', csrfError);
      return new Response(
        JSON.stringify({ error: csrfError || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user authorization
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const userRole = roleData?.role;
    if (!userRole || !['admin', 'pharmacy', 'doctor'].includes(userRole)) {
      throw new Error('Insufficient permissions');
    }

    const { orderLineId, trackingNumber } = await req.json();

    console.log('Amazon tracking API called with:', { orderLineId, trackingNumber });

    if (!orderLineId || !trackingNumber) {
      console.error('Missing required parameters:', { orderLineId, trackingNumber });
      throw new Error('orderLineId and trackingNumber are required');
    }

    console.log('Checking rate limit for order_line:', orderLineId);

    // Get today's date in UTC
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    // Get rate limit config
    const { data: config } = await supabase
      .from('api_rate_limits_config')
      .select('max_calls_per_day')
      .eq('api_name', 'amazon_tracking')
      .single();

    const maxCallsPerDay = config?.max_calls_per_day || 3;

    // Check how many calls have been made today for this order_line
    const { data: todayCalls, error: callsError } = await supabase
      .from('amazon_tracking_api_calls')
      .select('id')
      .eq('order_line_id', orderLineId)
      .gte('called_at', startOfToday)
      .lt('called_at', endOfToday);

    if (callsError) {
      console.error('Error checking rate limit:', callsError);
      throw callsError;
    }

    const callsToday = todayCalls?.length || 0;

    // If rate limit exceeded, return cached data
    if (callsToday >= maxCallsPerDay) {
      console.log(`Rate limit exceeded for order_line ${orderLineId}: ${callsToday}/${maxCallsPerDay}`);

      // Get the most recent cached tracking data
      const { data: latestCall } = await supabase
        .from('amazon_tracking_api_calls')
        .select('api_response, called_at')
        .eq('order_line_id', orderLineId)
        .order('called_at', { ascending: false })
        .limit(1)
        .single();

      return new Response(
        JSON.stringify({
          data: latestCall?.api_response || null,
          cached: true,
          cached_at: latestCall?.called_at,
          rate_limit_message: `Daily tracking limit reached (${callsToday}/${maxCallsPerDay}). Showing cached data.`,
          next_refresh_available: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString(),
          calls_remaining_today: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Making Amazon tracking API call (${callsToday + 1}/${maxCallsPerDay})`);

    // Make actual API call to Amazon Shipping API
    // Note: This is a placeholder - actual implementation will need Amazon credentials
    const trackingData = await fetchAmazonTracking(trackingNumber);

    // Log the API call
    const { error: logError } = await supabase.from('amazon_tracking_api_calls').insert({
      order_line_id: orderLineId,
      tracking_number: trackingNumber,
      called_by: user.id,
      response_status: 'success',
      api_response: trackingData,
    });

    if (logError) {
      console.error('Error logging API call:', logError);
    }

    return new Response(
      JSON.stringify({
        data: trackingData,
        cached: false,
        calls_remaining_today: maxCallsPerDay - callsToday - 1,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in amazon-get-tracking:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Placeholder function for Amazon API call
async function fetchAmazonTracking(trackingNumber: string) {
  // TODO: Implement actual Amazon Shipping API v2 call when credentials are available
  // For now, return mock data
  console.log('Fetching tracking for:', trackingNumber);
  
  return {
    tracking_number: trackingNumber,
    status: 'in_transit',
    carrier: 'Amazon Shipping',
    estimated_delivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    events: [
      {
        timestamp: new Date().toISOString(),
        location: 'Distribution Center',
        description: 'Package in transit',
      },
    ],
  };
}
