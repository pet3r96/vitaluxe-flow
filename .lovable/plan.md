
## VIOS Product Export Edge Function Audit & Fix

### Issues Identified

#### Issue 1: Column `product_type` Does Not Exist
The `products` table was migrated to use a foreign key relationship instead of a string column:
- **Current code**: `product_type` (line 82) - This column was **dropped** from the `products` table
- **Correct approach**: The product type name is now accessed via `product_types(name)` join on the `product_type_id` foreign key

#### Issue 2: Deployment May Be Stale  
The edge function logs still show errors for `product_variants_1.label` even though the code was updated to use `dosage_label`. This suggests either:
- The deployment didn't complete successfully
- The function needs to be redeployed

---

### Required Fix

**File: `supabase/functions/export-vios-products/index.ts`**

Update the query to use the correct relational pattern (matching how other functions like `send-vios-order` and `get-orders-page` work):

```typescript
// Line 77-95 - Update the query
const { data: products, error: productsError } = await supabase
  .from("products")
  .select(`
    id,
    name,
    product_types(name),
    dosage_form,
    base_price,
    vios_lf_product_id,
    product_variants (
      id,
      dosage_label,
      base_price,
      product_code
    )
  `)
  .in("id", productIds)
  .eq("active", true)
  .order("name");
```

Update the CSV row builder to access the nested product type:

```typescript
// Line 127 and 138 - Access product type via relationship
escapeCSV(product.product_types?.name || ""),
```

---

### Complete Fix Summary

| Line | Current Code | Fixed Code |
|------|--------------|------------|
| 82 | `product_type,` | `product_types(name),` |
| 127 | `escapeCSV(product.product_type \|\| ""),` | `escapeCSV(product.product_types?.name \|\| ""),` |
| 139 | `escapeCSV(product.product_type \|\| ""),` | `escapeCSV(product.product_types?.name \|\| ""),` |

---

### Technical Details

The database schema was migrated in `20251017022944_*` to:
1. Create a `product_types` table with columns: `id`, `name`, `active`, `is_glp`, `glp_clinical_statement`
2. Add `product_type_id` foreign key to `products` table
3. Drop the old `product_type` string column

This is the same pattern used in:
- `src/services/products/productService.ts` - `product_types(id, name)`
- `supabase/functions/send-vios-order/index.ts` - `product_types(is_glp, glp_clinical_statement)`
- `supabase/functions/get-orders-page/index.ts` - `product_types(id, name)`

---

### After Implementation

1. Update the edge function code with the fixes above
2. Redeploy the `export-vios-products` edge function
3. Test the export from Admin Settings → VIOS Mapping

The export should then successfully generate a CSV with all 295 product variants.
