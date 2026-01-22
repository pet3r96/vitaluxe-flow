/**
 * Import VIOS Product Catalog
 * 
 * Supports:
 * 1. CSV data upload (Content-Type: text/csv)
 * 2. JSON array upload (Content-Type: application/json)
 * 3. VIOS API fetch (fallback - typically 404s)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { edgeLogger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CatalogRecord {
  med_id: string;
  product_name: string;
  form: string | null;
  strength: string | null;
  units: string | null;
  package: string | null;
  schedule: string | null;
}

/**
 * Parse CSV content into catalog records
 */
function parseCSV(csvContent: string): CatalogRecord[] {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return [];
  
  // Parse header to get column indices
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const medIdIdx = header.findIndex(h => h === 'med_id' || h === 'medid');
  const nameIdx = header.findIndex(h => h === 'product_name' || h === 'productname' || h === 'name');
  const formIdx = header.findIndex(h => h === 'form');
  const strengthIdx = header.findIndex(h => h === 'strength');
  const unitsIdx = header.findIndex(h => h === 'units');
  const packageIdx = header.findIndex(h => h === 'package');
  const scheduleIdx = header.findIndex(h => h === 'schedule');
  
  if (medIdIdx === -1 || nameIdx === -1) {
    throw new Error('CSV must have Med ID and Product Name columns');
  }
  
  const records: CatalogRecord[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle quoted CSV fields
    const fields: string[] = [];
    let field = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(field.trim());
        field = '';
      } else {
        field += char;
      }
    }
    fields.push(field.trim());
    
    const medId = fields[medIdIdx]?.replace(/"/g, '').trim();
    if (!medId) continue;
    
    records.push({
      med_id: medId,
      product_name: fields[nameIdx]?.replace(/"/g, '').trim() || 'Unknown Product',
      form: formIdx >= 0 ? fields[formIdx]?.replace(/"/g, '').trim() || null : null,
      strength: strengthIdx >= 0 ? fields[strengthIdx]?.replace(/"/g, '').trim() || null : null,
      units: unitsIdx >= 0 ? fields[unitsIdx]?.replace(/"/g, '').trim() || null : null,
      package: packageIdx >= 0 ? fields[packageIdx]?.replace(/"/g, '').trim() || null : null,
      schedule: scheduleIdx >= 0 ? fields[scheduleIdx]?.replace(/"/g, '').trim() || null : null,
    });
  }
  
  return records;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let catalogRecords: CatalogRecord[] = [];
    let source = 'unknown';
    
    // Handle CSV upload
    if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
      const csvContent = await req.text();
      catalogRecords = parseCSV(csvContent);
      source = 'csv_upload';
      edgeLogger.info(`Parsed ${catalogRecords.length} products from CSV`);
    }
    // Handle JSON upload
    else if (contentType.includes('application/json')) {
      const body = await req.json();
      
      // Support { products: [...] } or direct array
      const products = body.products || (Array.isArray(body) ? body : []);
      
      catalogRecords = products.map((p: any) => ({
        med_id: String(p.med_id || p.medId || p.lfProductId || p.id || ''),
        product_name: p.product_name || p.productName || p.name || 'Unknown Product',
        form: p.form || null,
        strength: p.strength || null,
        units: p.units || null,
        package: p.package || null,
        schedule: p.schedule || null,
      })).filter((r: CatalogRecord) => r.med_id && r.med_id !== '');
      
      source = 'json_upload';
      edgeLogger.info(`Received ${catalogRecords.length} products from JSON`);
    }
    else {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Please upload CSV or JSON data",
          instructions: {
            csv: "POST with Content-Type: text/csv and CSV body with columns: Med ID, Product Name, Form, Strength, Units, Package, Schedule",
            json: "POST with Content-Type: application/json and body: { products: [{ med_id, product_name, form, strength, units, package, schedule }] }"
          }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (catalogRecords.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No valid products found in uploaded data"
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Batch upsert (1000 records per batch for safety)
    const BATCH_SIZE = 1000;
    let totalImported = 0;
    let errors: string[] = [];
    
    for (let i = 0; i < catalogRecords.length; i += BATCH_SIZE) {
      const batch = catalogRecords.slice(i, i + BATCH_SIZE);
      
      const { error } = await supabaseAdmin
        .from("vios_product_catalog")
        .upsert(batch, { 
          onConflict: "med_id",
          ignoreDuplicates: false 
        });

      if (error) {
        edgeLogger.error(`Batch ${Math.floor(i/BATCH_SIZE) + 1} failed`, error);
        errors.push(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        totalImported += batch.length;
      }
    }

    edgeLogger.info(`Successfully imported ${totalImported}/${catalogRecords.length} VIOS products`);

    return new Response(
      JSON.stringify({ 
        success: errors.length === 0, 
        imported: totalImported,
        total: catalogRecords.length,
        source,
        errors: errors.length > 0 ? errors : undefined,
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
