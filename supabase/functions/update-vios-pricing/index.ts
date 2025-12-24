import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Update Vios Products Pricing Edge Function
 * Fixes existing product AND variant prices to match the Excel spreadsheet
 * - Updates products table with correct pricing
 * - Updates product_variants table with correct pricing per dosage
 */

const VIOS_PHARMACY_ID = 'd5e75179-e66c-450f-8cae-1f4df93b097c';

// Product-level pricing (base prices for each product family)
const PRODUCT_PRICE_MAP: Record<string, { base: number; topline: number; downline: number; retail: number }> = {
  // Testosterone products
  'Testosterone Cream': { base: 19.71, topline: 27.60, downline: 33.60, retail: 37.60 },
  'Testosterone Cream (Men)': { base: 19.71, topline: 27.60, downline: 33.60, retail: 37.60 },
  'Testosterone Cream (Women)': { base: 19.71, topline: 27.60, downline: 33.60, retail: 37.60 },
  'Testosterone Cypionate': { base: 17.77, topline: 24.88, downline: 30.26, retail: 33.87 },
  'Testosterone Cypionate Injectable': { base: 17.77, topline: 24.88, downline: 30.26, retail: 33.87 },
  'Testosterone Enanthate': { base: 19.14, topline: 26.80, downline: 32.61, retail: 36.50 },
  'Testosterone Enanthate Injectable': { base: 19.14, topline: 26.80, downline: 32.61, retail: 36.50 },
  
  // Semaglutide products
  'Semaglutide': { base: 89.00, topline: 124.60, downline: 151.57, retail: 169.66 },
  'Semaglutide Injection': { base: 89.00, topline: 124.60, downline: 151.57, retail: 169.66 },
  'Semaglutide/B12 Injection': { base: 109.00, topline: 152.60, downline: 185.62, retail: 207.77 },
  'Semaglutide Sublingual': { base: 99.00, topline: 138.60, downline: 168.60, retail: 188.69 },
  'Semaglutide RDT': { base: 99.00, topline: 138.60, downline: 168.60, retail: 188.69 },
  
  // Tirzepatide
  'Tirzepatide': { base: 139.00, topline: 194.60, downline: 236.67, retail: 264.93 },
  'Tirzepatide Injection': { base: 139.00, topline: 194.60, downline: 236.67, retail: 264.93 },
  
  // Hormone products
  'Progesterone Capsules': { base: 11.43, topline: 16.00, downline: 19.47, retail: 21.78 },
  'Progesterone Micronized Capsules': { base: 11.43, topline: 16.00, downline: 19.47, retail: 21.78 },
  'Progesterone Cream': { base: 14.86, topline: 20.80, downline: 25.32, retail: 28.33 },
  'Progesterone SR': { base: 15.43, topline: 21.60, downline: 26.29, retail: 29.41 },
  'Estradiol Cream': { base: 16.86, topline: 23.60, downline: 28.72, retail: 32.13 },
  'Estriol Cream': { base: 25.14, topline: 35.20, downline: 42.82, retail: 47.93 },
  'Bi-est Cream': { base: 18.00, topline: 25.20, downline: 30.67, retail: 34.32 },
  'Tri-est Cream': { base: 20.57, topline: 28.80, downline: 35.04, retail: 39.22 },
  'DHEA Capsules': { base: 8.57, topline: 12.00, downline: 14.60, retail: 16.34 },
  'DHEA Cream': { base: 14.57, topline: 20.40, downline: 24.82, retail: 27.78 },
  'Pregnenolone Capsules': { base: 10.29, topline: 14.40, downline: 17.52, retail: 19.61 },
  
  // Thyroid
  'Liothyronine SR': { base: 12.86, topline: 18.00, downline: 21.90, retail: 24.51 },
  'Liothyronine Capsules': { base: 10.29, topline: 14.40, downline: 17.52, retail: 19.61 },
  'Levothyroxine Capsules': { base: 11.43, topline: 16.00, downline: 19.47, retail: 21.78 },
  'T3/T4 Capsules': { base: 14.00, topline: 19.60, downline: 23.84, retail: 26.69 },
  'Desiccated Thyroid': { base: 17.14, topline: 24.00, downline: 29.21, retail: 32.68 },
  'Nature-Throid': { base: 17.14, topline: 24.00, downline: 29.21, retail: 32.68 },
  
  // Sexual Health
  'Tadalafil Capsules': { base: 14.29, topline: 20.00, downline: 24.34, retail: 27.24 },
  'Tadalafil Troches': { base: 21.43, topline: 30.00, downline: 36.51, retail: 40.86 },
  'Tadalafil/Oxytocin Troches': { base: 29.14, topline: 40.80, downline: 49.64, retail: 55.56 },
  'Sildenafil Capsules': { base: 12.86, topline: 18.00, downline: 21.90, retail: 24.51 },
  'Sildenafil Troches': { base: 20.00, topline: 28.00, downline: 34.07, retail: 38.13 },
  'Sildenafil/Oxytocin Troches': { base: 27.71, topline: 38.80, downline: 47.21, retail: 52.83 },
  'PT-141 Injection': { base: 32.00, topline: 44.80, downline: 54.51, retail: 61.02 },
  'PT-141 Nasal Spray': { base: 36.57, topline: 51.20, downline: 62.30, retail: 69.73 },
  'Oxytocin Troches': { base: 17.14, topline: 24.00, downline: 29.21, retail: 32.68 },
  'Oxytocin Nasal Spray': { base: 20.00, topline: 28.00, downline: 34.07, retail: 38.13 },
  
  // Peptides
  'BPC-157 Injection': { base: 37.14, topline: 52.00, downline: 63.27, retail: 70.82 },
  'BPC-157 Capsules': { base: 32.00, topline: 44.80, downline: 54.51, retail: 61.02 },
  'Sermorelin Injection': { base: 44.57, topline: 62.40, downline: 75.92, retail: 84.98 },
  'Sermorelin/Glycine': { base: 49.14, topline: 68.80, downline: 83.71, retail: 93.69 },
  'Ipamorelin Injection': { base: 39.43, topline: 55.20, downline: 67.16, retail: 75.17 },
  'CJC-1295/Ipamorelin': { base: 54.86, topline: 76.80, downline: 93.44, retail: 104.58 },
  'Tesamorelin Injection': { base: 92.57, topline: 129.60, downline: 157.68, retail: 176.49 },
  'MK-677 Capsules': { base: 33.14, topline: 46.40, downline: 56.46, retail: 63.20 },
  'AOD-9604 Injection': { base: 41.71, topline: 58.40, downline: 71.06, retail: 79.53 },
  'GHK-Cu Injection': { base: 43.43, topline: 60.80, downline: 73.98, retail: 82.80 },
  'Thymosin Alpha-1': { base: 48.00, topline: 67.20, downline: 81.77, retail: 91.52 },
  'Thymosin Beta-4': { base: 52.57, topline: 73.60, downline: 89.55, retail: 100.23 },
  'TB-500 Injection': { base: 47.43, topline: 66.40, downline: 80.79, retail: 90.43 },
  'NAD+ Injection': { base: 57.14, topline: 80.00, downline: 97.34, retail: 108.96 },
  'NAD+ Nasal Spray': { base: 52.00, topline: 72.80, downline: 88.58, retail: 99.14 },
  'Pentosan Polysulfate': { base: 44.00, topline: 61.60, downline: 74.95, retail: 83.89 },
  'Epithalon Injection': { base: 61.71, topline: 86.40, downline: 105.13, retail: 117.68 },
  'Glutathione Injection': { base: 18.86, topline: 26.40, downline: 32.12, retail: 35.95 },
  'Glutathione Capsules': { base: 24.00, topline: 33.60, downline: 40.88, retail: 45.76 },
  
  // Vitamins
  'Vitamin B12 Injection': { base: 8.00, topline: 11.20, downline: 13.63, retail: 15.25 },
  'MIC/B12 Lipotropic Injection': { base: 11.43, topline: 16.00, downline: 19.47, retail: 21.78 },
  'Vitamin D3 Injection': { base: 10.29, topline: 14.40, downline: 17.52, retail: 19.61 },
  'B Complex Injection': { base: 12.00, topline: 16.80, downline: 20.44, retail: 22.88 },
  
  // LDN / Metformin
  'Low Dose Naltrexone (LDN)': { base: 14.29, topline: 20.00, downline: 24.34, retail: 27.24 },
  'LDN Capsules': { base: 14.29, topline: 20.00, downline: 24.34, retail: 27.24 },
  'Metformin ER Capsules': { base: 13.71, topline: 19.20, downline: 23.36, retail: 26.15 },
  
  // Hair Loss
  'Finasteride Capsules': { base: 12.86, topline: 18.00, downline: 21.90, retail: 24.51 },
  'Minoxidil Solution': { base: 17.14, topline: 24.00, downline: 29.21, retail: 32.68 },
  'Minoxidil/Finasteride Solution': { base: 24.00, topline: 33.60, downline: 40.88, retail: 45.76 },
  'Minoxidil/Tretinoin/Finasteride': { base: 32.00, topline: 44.80, downline: 54.51, retail: 61.02 },
  'Dutasteride Capsules': { base: 16.00, topline: 22.40, downline: 27.26, retail: 30.51 },
  'Ketoconazole Shampoo': { base: 14.86, topline: 20.80, downline: 25.32, retail: 28.33 },
  'Latanoprost Solution': { base: 22.86, topline: 32.00, downline: 38.93, retail: 43.58 },
  
  // Skin
  'Tretinoin Cream': { base: 15.43, topline: 21.60, downline: 26.29, retail: 29.41 },
  'Hydroquinone Cream': { base: 18.29, topline: 25.60, downline: 31.15, retail: 34.86 },
  'Azelaic Acid Cream': { base: 16.57, topline: 23.20, downline: 28.24, retail: 31.61 },
  'Vitamin C Serum': { base: 19.43, topline: 27.20, downline: 33.10, retail: 37.04 },
  'Niacinamide Cream': { base: 14.29, topline: 20.00, downline: 24.34, retail: 27.24 },
  
  // Pain
  'Ketamine Troches': { base: 26.86, topline: 37.60, downline: 45.75, retail: 51.20 },
  'Ketamine Cream': { base: 32.00, topline: 44.80, downline: 54.51, retail: 61.02 },
  'Gabapentin Cream': { base: 21.14, topline: 29.60, downline: 36.02, retail: 40.32 },
  'Lidocaine Cream': { base: 12.57, topline: 17.60, downline: 21.42, retail: 23.97 },
  
  // Sleep
  'Melatonin Capsules': { base: 7.43, topline: 10.40, downline: 12.65, retail: 14.16 },
  'Melatonin SR Capsules': { base: 9.71, topline: 13.60, downline: 16.55, retail: 18.52 },
  'Trazodone Capsules': { base: 11.14, topline: 15.60, downline: 18.98, retail: 21.24 },
};

// Comprehensive variant-level pricing - FROM EXCEL SPREADSHEET
// Key: "ProductName|DosagePattern" -> prices
const VARIANT_PRICE_MAP: Record<string, { base: number; topline: number; downline: number; retail: number }> = {
  // === TIRZEPATIDE VARIANTS (6 dosages) ===
  'Tirzepatide|2.5mg': { base: 139.00, topline: 194.60, downline: 236.67, retail: 264.93 },
  'Tirzepatide|5mg': { base: 159.00, topline: 222.60, downline: 270.77, retail: 303.10 },
  'Tirzepatide|7.5mg': { base: 179.00, topline: 250.60, downline: 304.87, retail: 341.26 },
  'Tirzepatide|10mg': { base: 199.00, topline: 278.60, downline: 338.97, retail: 379.43 },
  'Tirzepatide|12.5mg': { base: 229.00, topline: 320.60, downline: 390.08, retail: 436.69 },
  'Tirzepatide|15mg': { base: 259.00, topline: 362.60, downline: 441.19, retail: 493.96 },
  
  // === SEMAGLUTIDE INJECTION VARIANTS ===
  'Semaglutide|0.25mg': { base: 89.00, topline: 124.60, downline: 151.57, retail: 169.66 },
  'Semaglutide|0.5mg': { base: 89.00, topline: 124.60, downline: 151.57, retail: 169.66 },
  'Semaglutide|1mg': { base: 109.00, topline: 152.60, downline: 185.62, retail: 207.77 },
  'Semaglutide|1.7mg': { base: 129.00, topline: 180.60, downline: 219.68, retail: 245.89 },
  'Semaglutide|2mg': { base: 129.00, topline: 180.60, downline: 219.68, retail: 245.89 },
  'Semaglutide|2.4mg': { base: 149.00, topline: 208.60, downline: 253.73, retail: 284.00 },
  
  // === SEMAGLUTIDE RDT VARIANTS ===
  'Semaglutide RDT|0.5mg': { base: 99.00, topline: 138.60, downline: 168.60, retail: 188.69 },
  'Semaglutide RDT|1mg': { base: 119.00, topline: 166.60, downline: 202.62, retail: 226.77 },
  'Semaglutide RDT|2mg': { base: 139.00, topline: 194.60, downline: 236.67, retail: 264.93 },
  'Semaglutide RDT|2.4mg': { base: 139.00, topline: 194.60, downline: 236.67, retail: 264.93 },
  
  // === SEMAGLUTIDE SUBLINGUAL VARIANTS ===
  'Semaglutide Sublingual|0.5mg': { base: 99.00, topline: 138.60, downline: 168.60, retail: 188.69 },
  'Semaglutide Sublingual|1mg': { base: 119.00, topline: 166.60, downline: 202.62, retail: 226.77 },
  'Semaglutide Sublingual|2mg': { base: 139.00, topline: 194.60, downline: 236.67, retail: 264.93 },
  
  // === TESTOSTERONE CREAM - all variants same price ===
  'Testosterone Cream|50mg/mL': { base: 19.71, topline: 27.60, downline: 33.60, retail: 37.60 },
  'Testosterone Cream|100mg/mL': { base: 19.71, topline: 27.60, downline: 33.60, retail: 37.60 },
  'Testosterone Cream|200mg/mL': { base: 19.71, topline: 27.60, downline: 33.60, retail: 37.60 },
  
  // === TESTOSTERONE CYPIONATE ===
  'Testosterone Cypionate|100mg/mL': { base: 15.77, topline: 22.08, downline: 26.86, retail: 30.07 },
  'Testosterone Cypionate|200mg/mL': { base: 17.77, topline: 24.88, downline: 30.26, retail: 33.87 },
  
  // === TESTOSTERONE ENANTHATE ===
  'Testosterone Enanthate|200mg/mL': { base: 19.14, topline: 26.80, downline: 32.61, retail: 36.50 },
};

/**
 * Match a variant to its price data from the VARIANT_PRICE_MAP
 */
function findVariantPrice(productName: string, dosageLabel: string): { base: number; topline: number; downline: number; retail: number } | null {
  // Normalize product name (handle variations)
  const normalizedProduct = productName
    .replace(' Injectable', '')
    .replace(' Injection', '')
    .replace(' (Men)', '')
    .replace(' (Women)', '');
  
  // Try direct match first
  for (const [key, prices] of Object.entries(VARIANT_PRICE_MAP)) {
    const [product, dosagePattern] = key.split('|');
    
    if (normalizedProduct.includes(product) || product.includes(normalizedProduct)) {
      // Check if dosage matches pattern
      if (dosageLabel.toLowerCase().includes(dosagePattern.toLowerCase())) {
        return prices;
      }
    }
  }
  
  // Fallback: use product-level pricing
  const productPrice = PRODUCT_PRICE_MAP[productName] || PRODUCT_PRICE_MAP[normalizedProduct];
  return productPrice || null;
}

/**
 * Calculate tier prices from base price using standard multipliers
 */
function calculateTierPrices(basePrice: number): { topline: number; downline: number; retail: number } {
  return {
    topline: Math.round(basePrice * 1.40 * 100) / 100,
    downline: Math.round(basePrice * 1.7037 * 100) / 100,
    retail: Math.round(basePrice * 1.9063 * 100) / 100,
  };
}

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

    console.log(`Starting COMPLETE Vios pricing update... Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

    // Fetch all Vios products with their variants
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
      variantsUpdated: 0,
      variantsSkipped: 0,
      productUpdates: [] as { name: string; changes: any }[],
      variantUpdates: [] as { product: string; dosage: string; changes: any }[],
      errors: [] as string[],
    };

    // === PHASE 1: Update Products ===
    console.log('\n=== PHASE 1: Updating Products ===');
    for (const product of products || []) {
      const priceData = PRODUCT_PRICE_MAP[product.name];
      
      if (!priceData) {
        console.log(`  No price data for: ${product.name}`);
        results.productsSkipped++;
        continue;
      }

      const needsUpdate = 
        product.topline_price !== priceData.topline ||
        product.downline_price !== priceData.downline ||
        product.base_price !== priceData.base ||
        product.retail_price !== priceData.retail;

      if (!needsUpdate) {
        results.productsSkipped++;
        continue;
      }

      console.log(`  Updating: ${product.name}`);

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
          results.errors.push(`Product ${product.name}: ${updateError.message}`);
          continue;
        }
      }

      results.productsUpdated++;
      results.productUpdates.push({
        name: product.name,
        changes: {
          base: { from: product.base_price, to: priceData.base },
          topline: { from: product.topline_price, to: priceData.topline },
          downline: { from: product.downline_price, to: priceData.downline },
          retail: { from: product.retail_price, to: priceData.retail },
        },
      });
    }

    // === PHASE 2: Update Product Variants ===
    console.log('\n=== PHASE 2: Updating Product Variants ===');
    
    // Fetch all variants for Vios products
    const { data: variants, error: variantFetchError } = await supabase
      .from('product_variants')
      .select('id, product_id, dosage_label, base_price, topline_price, downline_price, retail_price, products!inner(name, pharmacy_id)')
      .eq('products.pharmacy_id', VIOS_PHARMACY_ID);

    if (variantFetchError) {
      console.error(`Failed to fetch variants: ${variantFetchError.message}`);
    } else {
      console.log(`Found ${variants?.length || 0} variants to check`);

      for (const variant of variants || []) {
        const productName = (variant as any).products?.name;
        if (!productName) continue;

        // Find appropriate pricing for this variant
        const variantPrice = findVariantPrice(productName, variant.dosage_label);
        
        if (!variantPrice) {
          // Calculate from base price if no specific pricing
          if (variant.base_price && (!variant.topline_price || !variant.downline_price)) {
            const calculated = calculateTierPrices(variant.base_price);
            
            if (!dryRun) {
              const { error: updateError } = await supabase
                .from('product_variants')
                .update({
                  topline_price: calculated.topline,
                  downline_price: calculated.downline,
                  retail_price: calculated.retail,
                })
                .eq('id', variant.id);

              if (updateError) {
                results.errors.push(`Variant ${productName} ${variant.dosage_label}: ${updateError.message}`);
              } else {
                results.variantsUpdated++;
              }
            } else {
              results.variantsUpdated++;
            }
          } else {
            results.variantsSkipped++;
          }
          continue;
        }

        // Check if update needed
        const needsUpdate = 
          variant.base_price !== variantPrice.base ||
          variant.topline_price !== variantPrice.topline ||
          variant.downline_price !== variantPrice.downline ||
          variant.retail_price !== variantPrice.retail;

        if (!needsUpdate) {
          results.variantsSkipped++;
          continue;
        }

        console.log(`  Updating variant: ${productName} - ${variant.dosage_label}`);

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('product_variants')
            .update({
              base_price: variantPrice.base,
              topline_price: variantPrice.topline,
              downline_price: variantPrice.downline,
              retail_price: variantPrice.retail,
            })
            .eq('id', variant.id);

          if (updateError) {
            results.errors.push(`Variant ${productName} ${variant.dosage_label}: ${updateError.message}`);
            continue;
          }
        }

        results.variantsUpdated++;
        results.variantUpdates.push({
          product: productName,
          dosage: variant.dosage_label,
          changes: {
            base: { from: variant.base_price, to: variantPrice.base },
            topline: { from: variant.topline_price, to: variantPrice.topline },
            downline: { from: variant.downline_price, to: variantPrice.downline },
            retail: { from: variant.retail_price, to: variantPrice.retail },
          },
        });
      }
    }

    const message = dryRun
      ? `Dry run complete: ${results.productsUpdated} products, ${results.variantsUpdated} variants would be updated`
      : `Updated ${results.productsUpdated} products, ${results.variantsUpdated} variants`;

    console.log(`\n${message}`);
    console.log(`Products skipped: ${results.productsSkipped}`);
    console.log(`Variants skipped: ${results.variantsSkipped}`);
    console.log(`Errors: ${results.errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message,
        dryRun,
        summary: {
          productsUpdated: results.productsUpdated,
          productsSkipped: results.productsSkipped,
          variantsUpdated: results.variantsUpdated,
          variantsSkipped: results.variantsSkipped,
          errorsCount: results.errors.length,
        },
        productUpdates: results.productUpdates.slice(0, 10),
        variantUpdates: results.variantUpdates.slice(0, 20),
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
