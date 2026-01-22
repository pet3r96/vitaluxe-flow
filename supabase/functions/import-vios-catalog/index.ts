/**
 * Import VIOS Product Catalog
 * 
 * Fetches products from VIOS API and populates the vios_product_catalog table.
 * This catalog is used to enforce product assignments and validate orders.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { edgeLogger } from "../_shared/logger.ts";
import { isViosEnabled, throttledViosApiRequest } from "../_shared/vios/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ViosCatalogProduct {
  lfProductId?: number;
  medId?: number;
  id?: number;
  productName?: string;
  name?: string;
  form?: string;
  strength?: string;
  units?: string;
  package?: string;
  schedule?: string;
  scheduleCode?: number;
}

interface ViosPaginatedResponse {
  items?: ViosCatalogProduct[];
  data?: ViosCatalogProduct[];
  totalCount?: number;
  pageSize?: number;
  pageNumber?: number;
  totalPages?: number;
  hasNextPage?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isViosEnabled()) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "VIOS integration is disabled. Set VIOS_ENABLED=true to enable.",
        code: "VIOS_DISABLED"
      }),
      { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    edgeLogger.info("Starting VIOS catalog import");
    
    // Fetch catalog from VIOS API (paginated)
    const allProducts: ViosCatalogProduct[] = [];
    let page = 1;
    let hasMore = true;
    const maxPages = 100; // Safety limit
    
    while (hasMore && page <= maxPages) {
      edgeLogger.info(`Fetching VIOS catalog page ${page}`);
      
      const response = await throttledViosApiRequest<ViosPaginatedResponse | ViosCatalogProduct[]>(
        `/api/products?pageNumber=${page}&pageSize=100`,
        { method: "GET" }
      );
      
      // Handle both array and paginated response formats
      let items: ViosCatalogProduct[];
      if (Array.isArray(response)) {
        items = response;
        hasMore = items.length === 100;
      } else {
        items = response.items || response.data || [];
        hasMore = response.hasNextPage ?? items.length === 100;
      }
      
      if (items.length > 0) {
        allProducts.push(...items);
        page++;
      } else {
        hasMore = false;
      }
    }

    if (allProducts.length === 0) {
      edgeLogger.warn("VIOS catalog returned 0 products");
      return new Response(
        JSON.stringify({ 
          success: true, 
          imported: 0,
          message: "VIOS API returned no products. Catalog may require different endpoint."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info(`Fetched ${allProducts.length} products from VIOS API`);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Transform to catalog records
    const catalogRecords = allProducts.map((p) => ({
      med_id: String(p.lfProductId || p.medId || p.id || ''),
      product_name: p.productName || p.name || 'Unknown Product',
      form: p.form || null,
      strength: p.strength || null,
      units: p.units || null,
      package: p.package || null,
      schedule: p.schedule || (p.scheduleCode ? String(p.scheduleCode) : null),
    })).filter(r => r.med_id); // Only include records with valid med_id

    if (catalogRecords.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No valid product IDs found in VIOS response",
          sample_data: allProducts.slice(0, 3)
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert into vios_product_catalog
    const { data, error } = await supabaseAdmin
      .from("vios_product_catalog")
      .upsert(catalogRecords, { 
        onConflict: "med_id",
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      edgeLogger.error("Failed to upsert VIOS catalog", error);
      throw error;
    }

    edgeLogger.info(`Successfully imported ${catalogRecords.length} VIOS products`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: catalogRecords.length,
        pages_fetched: page - 1,
        sample: catalogRecords.slice(0, 3)
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    edgeLogger.error("VIOS catalog import error", error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
