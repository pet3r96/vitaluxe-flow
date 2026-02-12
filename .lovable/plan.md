
# Import Full VIOS Product Catalog (305 Items)

## Summary

Import all 305 products from your spreadsheet into the database as ~57 product families with multiple variants each. Every product will be:
- Marked as requires prescription
- Assigned to Vios Compounding pharmacy
- Visible to all reps
- Priced with base price and practice price (no rep pricing)
- Linked to the correct VIOS Product ID for API ordering

## How Products Will Be Grouped

Products with the same name and dosage form become one product with multiple variants. Different sizes (30g vs 90g, 30ct vs 90ct) are variants under the same product.

Examples:
- **Semaglutide ODT** (Tab Disintegrating) = 1 product with 12 variants (250 MCG through 12 MG)
- **BIEST (20:80)** Cream = 1 product with 8 variants (4 strengths x 2 sizes: 30g and 90g)
- **PROGESTERONE IR** Capsule = 1 product with 12 variants (6 strengths x 2 sizes: 30ct and 90ct)
- **TESTOSTERONE** Cream = 1 product with 12 variants (6 strengths x 2 sizes)

## Product Type Assignments

| Category | Products |
|----------|----------|
| GLP 1 | Semaglutide/Methylcobalamin/Glycine, Semaglutide/L-Carnitine, Semaglutide ODT, Tirzepatide/Glycine/Methylcobalamin, Tirzepatide/L-Carnitine, Tirzepatide ODT |
| Hormone Therapy | BIEST (20:80), BIEST (50:50), DHEA, ESTRADIOL, ESTRIOL, PROGESTERONE (all forms), TESTOSTERONE (all forms), PREGNENOLONE, OXYTOCIN, NANDROLONE DECANOATE, Testosterone Cypionate GSO, Testosterone Enanthate |
| Thyroid | LIOTHYRONINE (T3) IR, LIOTHYRONINE (T3) SR, LEVOTHYROXINE, T4/T3 (BIOTHYROID) |
| Sexual Health | TADALAFIL, SILDENAFIL CITRATE, ENCLOMIPHENE CITRATE, CLOMIPHENE CITRATE, GONADORELIN |
| Hair Care | Finasteride, MINOXIDIL, FINASTERIDE/MINOXIDIL |
| Anti-Aging | GHK-CU, HYDROQUINONE, TRETINOIN, Methylene Blue, NAD+ |
| Peptides | SERMORELIN |
| Vitamins | Glutathione, Methylcobalamin, MIC-B12, ASCORBIC ACID combo |

## Variant Labeling

Each variant's dosage label will include both strength and size for clarity:
- `"1mg/1mg/10mg/ml - 1mL"` (injection)
- `"1 MG/ML - 30g"` (cream)
- `"250 MCG - 30ct"` (tablet/capsule)

## Implementation Approach

### Step 1: Create Edge Function for Bulk Import

Build a backend function (`import-product-catalog`) that:
1. Accepts the full structured product data
2. Inserts each product family into the `products` table
3. Inserts all variants into `product_variants` with correct VIOS Product IDs
4. Creates `product_pharmacies` entries linking each product to Vios Compounding
5. Returns a summary of what was created

### Step 2: Trigger the Import

Call the edge function with all 305 rows pre-grouped into ~57 product families. The function handles everything in a single operation.

### Step 3: Verify

Confirm all products appear on the Products page with correct pricing, variants, and pharmacy assignments.

## Technical Details

- **Products table**: name, dosage_form, requires_prescription=true, is_glp1 (true for semaglutide/tirzepatide), product_type_id, base_price (from first variant), retail_price (from first variant)
- **Product variants**: dosage_label, base_price, retail_price, product_code (VIOS Product ID), active=true
- **Product pharmacies**: links each product to Vios Compounding (id: d5e75179-e66c-450f-8cae-1f4df93b097c)
- **No topline_price or downline_price** per your instructions
- **Duplicate VIOS IDs** kept as-is (same code for different quantities)
- **Deduplication**: The spreadsheet has some duplicate rows (e.g., DHEA SR appears twice, NAD+ Troche appears twice, one ESTRADIOL Cream duplicate) - these will be deduplicated during import
