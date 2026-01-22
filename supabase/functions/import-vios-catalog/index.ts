/**
 * Import VIOS Product Catalog
 * 
 * Attempts to fetch products from VIOS API endpoints and populates the vios_product_catalog table.
 * Falls back to manual catalog population if API doesn't expose product listing.
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

// Possible VIOS API endpoints for product catalog
const CATALOG_ENDPOINTS = [
  '/api/drugs',
  '/api/formulary', 
  '/api/products',
  '/api/catalog',
  '/api/medications'
];

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
    // Check for manual catalog data in request body
    let manualData: ViosCatalogProduct[] = [];
    try {
      const body = await req.json();
      if (body.products && Array.isArray(body.products)) {
        manualData = body.products;
      }
    } catch {
      // No body provided, will try API endpoints
    }

    let allProducts: ViosCatalogProduct[] = [];
    let successfulEndpoint: string | null = null;
    const attemptedEndpoints: string[] = [];

    // If manual data provided, use it directly
    if (manualData.length > 0) {
      allProducts = manualData;
      successfulEndpoint = 'manual_upload';
      edgeLogger.info(`Using ${manualData.length} manually provided products`);
    } else {
      // Try each possible endpoint
      for (const endpoint of CATALOG_ENDPOINTS) {
        try {
          edgeLogger.info(`Attempting VIOS catalog endpoint: ${endpoint}`);
          attemptedEndpoints.push(endpoint);
          
          const response = await throttledViosApiRequest<any>(
            `${endpoint}?pageNumber=1&pageSize=100`,
            { method: "GET" }
          );
          
          // Check for products in response
          const items = Array.isArray(response) 
            ? response 
            : (response.items || response.data || response.products || response.drugs || []);
          
          if (items.length > 0) {
            allProducts = items;
            successfulEndpoint = endpoint;
            edgeLogger.info(`Found ${items.length} products at ${endpoint}`);
            
            // Fetch remaining pages if paginated
            if (response.hasNextPage || response.totalPages > 1) {
              const totalPages = response.totalPages || Math.ceil((response.totalCount || 500) / 100);
              for (let page = 2; page <= Math.min(totalPages, 50); page++) {
                const pageResponse = await throttledViosApiRequest<any>(
                  `${endpoint}?pageNumber=${page}&pageSize=100`,
                  { method: "GET" }
                );
                const pageItems = Array.isArray(pageResponse) 
                  ? pageResponse 
                  : (pageResponse.items || pageResponse.data || []);
                allProducts.push(...pageItems);
              }
            }
            break;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          edgeLogger.info(`Endpoint ${endpoint} returned: ${errorMsg}`);
          // Continue to next endpoint
        }
      }
    }

    // If no products found via API
    if (allProducts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          imported: 0,
          attempted_endpoints: attemptedEndpoints,
          message: "VIOS API does not expose a product catalog endpoint. Products must be imported manually or via spreadsheet upload.",
          manual_import_instructions: {
            method: "POST",
            body_format: {
              products: [
                { 
                  lfProductId: 12345, 
                  productName: "Example Product", 
                  form: "Injection",
                  strength: "10mg/mL"
                }
              ]
            }
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info(`Processing ${allProducts.length} products from ${successfulEndpoint}`);

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
    })).filter(r => r.med_id && r.med_id !== ''); // Only include records with valid med_id

    if (catalogRecords.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No valid product IDs found in data. Each product must have lfProductId, medId, or id.",
          sample_data: allProducts.slice(0, 3)
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert into vios_product_catalog
    const { error } = await supabaseAdmin
      .from("vios_product_catalog")
      .upsert(catalogRecords, { 
        onConflict: "med_id",
        ignoreDuplicates: false 
      });

    if (error) {
      edgeLogger.error("Failed to upsert VIOS catalog", error);
      throw error;
    }

    edgeLogger.info(`Successfully imported ${catalogRecords.length} VIOS products`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: catalogRecords.length,
        source: successfulEndpoint,
        sample: catalogRecords.slice(0, 5)
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
