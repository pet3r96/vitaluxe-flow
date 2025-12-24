import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Update Vios Products Pricing Edge Function
 * Fixes existing product prices to match the seed function data
 * - Updates products table with correct topline_price and downline_price
 * - Ensures all 4 pricing tiers are properly set
 */

const VIOS_PHARMACY_ID = 'd5e75179-e66c-450f-8cae-1f4df93b097c';

// Price map: product name -> { base, topline, downline, retail } (for the primary/lowest variant)
// These are the correct prices from the seed function
const PRODUCT_PRICE_MAP: Record<string, { base: number; topline: number; downline: number; retail: number }> = {
  'Semaglutide/Methylcobalamin/Glycine': { base: 50, topline: 99, downline: 139, retail: 179 },
  'Semaglutide RDT': { base: 55, topline: 99, downline: 139, retail: 179 },
  'Tirzepatide': { base: 120, topline: 189, downline: 249, retail: 309 },
  'Bi-est 80/20 Cream': { base: 30, topline: 49, downline: 69, retail: 89 },
  'Bi-est 50/50 Cream': { base: 35, topline: 59, downline: 79, retail: 99 },
  'Estriol Cream': { base: 28, topline: 49, downline: 65, retail: 85 },
  'Estradiol Cream': { base: 30, topline: 52, downline: 69, retail: 89 },
  'Testosterone Cream (Men)': { base: 30, topline: 52, downline: 69, retail: 89 },
  'Testosterone Cream (Women)': { base: 30, topline: 52, downline: 69, retail: 89 },
  'Testosterone Cypionate': { base: 45, topline: 79, downline: 99, retail: 129 },
  'Testosterone Enanthate': { base: 55, topline: 95, downline: 119, retail: 149 },
  'Nandrolone Decanoate': { base: 90, topline: 149, downline: 189, retail: 239 },
  'Progesterone Capsules': { base: 25, topline: 45, downline: 59, retail: 75 },
  'Progesterone Cream': { base: 30, topline: 52, downline: 69, retail: 89 },
  'Progesterone SR Capsules': { base: 35, topline: 59, downline: 79, retail: 99 },
  'DHEA Capsules': { base: 18, topline: 32, downline: 45, retail: 59 },
  'DHEA Cream': { base: 30, topline: 52, downline: 69, retail: 89 },
  'Pregnenolone Capsules': { base: 22, topline: 40, downline: 55, retail: 69 },
  'Liothyronine (T3)': { base: 22, topline: 40, downline: 55, retail: 69 },
  'Liothyronine (T3) SR': { base: 30, topline: 52, downline: 69, retail: 89 },
  'Levothyroxine (T4)': { base: 25, topline: 45, downline: 59, retail: 75 },
  'T3/T4 Combination': { base: 40, topline: 69, downline: 89, retail: 109 },
  'T3/T4 Combination SR': { base: 50, topline: 85, downline: 109, retail: 135 },
  'Desiccated Thyroid': { base: 28, topline: 49, downline: 65, retail: 85 },
  'Tadalafil Capsules': { base: 25, topline: 45, downline: 59, retail: 75 },
  'Tadalafil Troches': { base: 30, topline: 52, downline: 69, retail: 89 },
  'Tadalafil/Oxytocin Troches': { base: 45, topline: 79, downline: 99, retail: 125 },
  'Sildenafil Capsules': { base: 28, topline: 45, downline: 62, retail: 79 },
  'Sildenafil Troches': { base: 30, topline: 52, downline: 69, retail: 89 },
  'Sildenafil/Oxytocin Troches': { base: 45, topline: 79, downline: 99, retail: 125 },
  'PT-141 (Bremelanotide)': { base: 60, topline: 99, downline: 129, retail: 169 },
  'Oxytocin Troches': { base: 45, topline: 79, downline: 99, retail: 119 },
  'Oxytocin Nasal Spray': { base: 55, topline: 95, downline: 119, retail: 149 },
  // Peptides
  'BPC-157': { base: 70, topline: 119, downline: 149, retail: 189 },
  'Sermorelin': { base: 120, topline: 189, downline: 249, retail: 309 },
  'Sermorelin/Glycine': { base: 130, topline: 199, downline: 269, retail: 329 },
  'Ipamorelin': { base: 100, topline: 159, downline: 209, retail: 259 },
  'CJC-1295/Ipamorelin': { base: 160, topline: 249, downline: 329, retail: 399 },
  'Tesamorelin': { base: 250, topline: 389, downline: 509, retail: 619 },
  'MK-677 (Ibutamoren)': { base: 80, topline: 129, downline: 169, retail: 209 },
  'GHK-Cu': { base: 90, topline: 149, downline: 189, retail: 239 },
  'Thymosin Alpha-1': { base: 120, topline: 189, downline: 249, retail: 309 },
  'Thymosin Beta-4': { base: 150, topline: 239, downline: 309, retail: 379 },
  'TB-500': { base: 140, topline: 219, downline: 289, retail: 359 },
  'Pentosan Polysulfate': { base: 100, topline: 159, downline: 209, retail: 259 },
  'Epithalon': { base: 180, topline: 289, downline: 379, retail: 459 },
  'NAD+ Injection': { base: 150, topline: 239, downline: 309, retail: 379 },
  'NAD+ Nasal Spray': { base: 120, topline: 189, downline: 249, retail: 309 },
  // Vitamins
  'Methylcobalamin (B12)': { base: 25, topline: 45, downline: 59, retail: 75 },
  'B Complex Injection': { base: 35, topline: 59, downline: 79, retail: 99 },
  'Lipotropic (MIC) Injection': { base: 40, topline: 69, downline: 89, retail: 109 },
  'Glutathione Injection': { base: 45, topline: 79, downline: 99, retail: 129 },
  'Vitamin D3 Capsules': { base: 20, topline: 35, downline: 49, retail: 65 },
  'Vitamin D3/K2 Capsules': { base: 25, topline: 45, downline: 59, retail: 75 },
  'LDN (Low Dose Naltrexone)': { base: 35, topline: 59, downline: 79, retail: 99 },
  'Methylene Blue Capsules': { base: 45, topline: 79, downline: 99, retail: 119 },
  // Hair Loss
  'Finasteride Capsules': { base: 30, topline: 52, downline: 69, retail: 89 },
  'Minoxidil/Finasteride Topical': { base: 65, topline: 109, downline: 139, retail: 179 },
  'Minoxidil/Tretinoin/Finasteride Topical': { base: 85, topline: 139, downline: 179, retail: 229 },
  'Ketoconazole/Minoxidil': { base: 55, topline: 95, downline: 119, retail: 149 },
  'Hair Growth Peptide Complex': { base: 120, topline: 189, downline: 249, retail: 309 },
  'Dutasteride Capsules': { base: 40, topline: 69, downline: 89, retail: 109 },
  'Latanoprost (Eyelash)': { base: 60, topline: 99, downline: 129, retail: 159 },
  // Skin/Aesthetics
  'Tretinoin Cream': { base: 35, topline: 59, downline: 79, retail: 99 },
  'Hydroquinone Cream': { base: 40, topline: 69, downline: 89, retail: 109 },
  'Tretinoin/Hydroquinone/Niacinamide': { base: 65, topline: 109, downline: 139, retail: 179 },
  'Tranexamic Acid Cream': { base: 55, topline: 95, downline: 119, retail: 149 },
  'Azelaic Acid Cream': { base: 40, topline: 69, downline: 89, retail: 109 },
  'Vitamin C Serum': { base: 45, topline: 79, downline: 99, retail: 119 },
  'Hyaluronic Acid Serum': { base: 50, topline: 89, downline: 109, retail: 139 },
  'Melasma Cream': { base: 75, topline: 129, downline: 159, retail: 199 },
  // Anti-Nausea
  'Ondansetron ODT': { base: 25, topline: 45, downline: 59, retail: 75 },
  'Promethazine Suppositories': { base: 30, topline: 52, downline: 69, retail: 89 },
  'Metoclopramide Capsules': { base: 22, topline: 40, downline: 55, retail: 69 },
  // Sleep
  'Melatonin Capsules': { base: 18, topline: 32, downline: 45, retail: 59 },
  'Melatonin SR Capsules': { base: 25, topline: 45, downline: 59, retail: 75 },
  'Trazodone Capsules': { base: 22, topline: 40, downline: 55, retail: 69 },
  'Gabapentin Capsules': { base: 25, topline: 45, downline: 59, retail: 75 },
  // Pain/Inflammation
  'Ketamine Troches': { base: 55, topline: 95, downline: 119, retail: 149 },
  'Ketamine/Gabapentin Cream': { base: 80, topline: 129, downline: 169, retail: 209 },
  'Diclofenac/Lidocaine/Gabapentin Cream': { base: 70, topline: 119, downline: 149, retail: 189 },
  'Ibuprofen/Menthol/Lidocaine Gel': { base: 45, topline: 79, downline: 99, retail: 119 },
  'CBD/Lidocaine Cream': { base: 65, topline: 109, downline: 139, retail: 179 },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { dryRun = false } = body;

    console.log(`Starting Vios pricing update... Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

    // Fetch all Vios products
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, base_price, topline_price, downline_price, retail_price')
      .eq('pharmacy_id', VIOS_PHARMACY_ID);

    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`);
    }

    console.log(`Found ${products?.length || 0} Vios products to check`);

    const results = {
      productsUpdated: 0,
      productsSkipped: 0,
      updates: [] as { name: string; changes: any }[],
      errors: [] as string[],
    };

    for (const product of products || []) {
      const priceData = PRODUCT_PRICE_MAP[product.name];
      
      if (!priceData) {
        console.log(`  No price data found for: ${product.name}`);
        results.productsSkipped++;
        continue;
      }

      // Check if any pricing needs updating
      const needsUpdate = 
        product.topline_price !== priceData.topline ||
        product.downline_price !== priceData.downline ||
        product.base_price !== priceData.base ||
        product.retail_price !== priceData.retail;

      if (!needsUpdate) {
        console.log(`  ${product.name}: Pricing already correct`);
        results.productsSkipped++;
        continue;
      }

      const changes = {
        base_price: { from: product.base_price, to: priceData.base },
        topline_price: { from: product.topline_price, to: priceData.topline },
        downline_price: { from: product.downline_price, to: priceData.downline },
        retail_price: { from: product.retail_price, to: priceData.retail },
      };

      console.log(`  ${product.name}: Updating prices`, changes);

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            base_price: priceData.base,
            topline_price: priceData.topline,
            downline_price: priceData.downline,
            retail_price: priceData.retail,
          })
          .eq('id', product.id);

        if (updateError) {
          console.error(`  Error updating ${product.name}: ${updateError.message}`);
          results.errors.push(`${product.name}: ${updateError.message}`);
          continue;
        }
      }

      results.productsUpdated++;
      results.updates.push({ name: product.name, changes });
    }

    const message = dryRun
      ? `Dry run complete: ${results.productsUpdated} products would be updated, ${results.productsSkipped} already correct`
      : `Updated ${results.productsUpdated} products, ${results.productsSkipped} already correct`;

    console.log(message);

    return new Response(
      JSON.stringify({
        success: true,
        message,
        dryRun,
        summary: {
          productsUpdated: results.productsUpdated,
          productsSkipped: results.productsSkipped,
          errorsCount: results.errors.length,
        },
        updates: results.updates.slice(0, 20),
        errors: results.errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Update pricing error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
