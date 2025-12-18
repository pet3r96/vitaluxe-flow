import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { getViosCredentials, viosRequest } from '../_shared/viosApi.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetOrdersRequest {
  pharmacy_id: string;
  page?: number;
  page_size?: number;
  status?: string;
  start_date?: string;
  end_date?: string;
  reference_id?: string;
}

interface ViosOrder {
  orderId: number;
  referenceId?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  patient?: {
    firstName: string;
    lastName: string;
  };
  tracking?: {
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();
    
    // Get request data
    const requestData: GetOrdersRequest = await req.json();
    const { pharmacy_id, page = 1, page_size = 50, status, start_date, end_date, reference_id } = requestData;

    if (!pharmacy_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'pharmacy_id is required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info("VIOS Get Orders: Starting", { pharmacy_id, page, page_size });

    // Get VIOS credentials
    const credentials = await getViosCredentials(supabaseAdmin, pharmacy_id);
    if (!credentials) {
      return new Response(
        JSON.stringify({ success: false, error: 'VIOS credentials not configured for this pharmacy' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build query parameters
    const queryParams: Record<string, string> = {
      page: String(page),
      pageSize: String(page_size)
    };

    if (status) queryParams.status = status;
    if (start_date) queryParams.startDate = start_date;
    if (end_date) queryParams.endDate = end_date;
    if (reference_id) queryParams.referenceId = reference_id;

    // Make VIOS API request
    const result = await viosRequest<{ orders: ViosOrder[]; totalCount: number; page: number; pageSize: number }>(
      credentials,
      'GET',
      '/api/orders',
      undefined,
      queryParams
    );

    if (!result.success) {
      edgeLogger.error("VIOS Get Orders: API call failed", { error: result.error });
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: result.statusCode || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info("VIOS Get Orders: Success", { 
      totalOrders: result.data?.totalCount,
      returnedOrders: result.data?.orders?.length
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result.data
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    edgeLogger.error("VIOS Get Orders: Exception", { error: errorMsg });
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
