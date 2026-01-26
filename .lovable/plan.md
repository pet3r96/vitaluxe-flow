

## Fix VIOS Med ID Manager - Schema Mismatch

### Issue Identified

The edge function export is working correctly - the CSV now generates with each product variant on its own line. However, the frontend component `ViosMedIdManager.tsx` has outdated database schema references that cause it to show incorrect data and display "0 variants".

### Root Cause

The component was written using old column names that no longer exist:
- `label` should be `dosage_label` (in `product_variants` table)
- `product_type` should use `product_types(name)` join (relational migration)

### Required Changes

**File: `src/components/admin/ViosMedIdManager.tsx`**

| Line | Current | Fixed |
|------|---------|-------|
| 17 | `label: string;` | `dosage_label: string;` |
| 63 | `label,` | `dosage_label,` |
| 69 | `product_type,` | `product_types(name),` |
| 74 | `.order("label")` | `.order("dosage_label")` |
| 87-88 | `v.label.toLowerCase()` | `v.dosage_label.toLowerCase()` |
| 24 | `product_type: string \| null;` | Access via nested `product_types` |
| 452-453 | `variant.product.product_type` | `(variant.product as any).product_types?.name` |
| 190 | `variant?.label` | `variant?.dosage_label` |

### Technical Details

The `ViosMedIdManager` component queries `product_variants` and `products` tables but uses:
- `label` instead of `dosage_label` (the correct column name)
- `product_type` instead of the joined `product_types(name)` (relational pattern)

This matches the same issue that was already fixed in the edge function.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/ViosMedIdManager.tsx` | Update all references from `label` to `dosage_label` and from `product_type` to `product_types(name)` |

### Summary

The exported CSV from the edge function now correctly lists each product variant on its own line with unique IDs. The frontend component needs the same schema fixes to display the variant data correctly and allow proper import/export workflow.

