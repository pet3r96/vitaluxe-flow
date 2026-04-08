

# Fix: Add Medication Strength & Form to Prescription PDF

## Problem
The prescription PDF only shows the product name (e.g., "Semaglutide/Methylcobalamin/Glycine") but not the strength and form. The variant's `dosage_label` field contains this info (e.g., "5mg/1mg/10mg/ml - 2mL") and needs to appear on the PDF.

## Data
- `product_variants.dosage_label` = `"5mg/1mg/10mg/ml - 2mL"`
- `order_lines.variant_id` = `"132744f4-b634-4341-970e-40ed30f0a2ff"`
- Currently the code only fetches `products.name` and ignores the variant

## Change

### File: `supabase/functions/generate-prescription-pdf/index.ts`

**1. Fetch variant data** (after the product fetch ~line 145):
- Query `product_variants` using `orderLine.variant_id` to get `dosage_label`

**2. Build full medication name** (line 240):
- Change `product_name: product.name` to include variant dosage_label:
  `product_name: variant?.dosage_label ? \`${product.name} ${variant.dosage_label}\` : product.name`
- Result on PDF: **"Semaglutide/Methylcobalamin/Glycine 5mg/1mg/10mg/ml - 2mL"**

**3. Also apply to the direct-call mode**: Ensure `PrescriptionWriterDialog` already passes the full name with strength (it likely does since it uses variant data directly — will verify and fix if needed).

### After deploy: Regenerate Renee Rodriguez's prescription
- Call with `order_line_id: 95d9e316-3cf2-4a6c-8cd9-f54b348b80dd`
- Verify the medication box shows the full name with strength and form

## Scope
- 1 file: `generate-prescription-pdf/index.ts`
- 1 regeneration call

