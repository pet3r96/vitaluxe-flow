

# Fix: Injectable Product Quantity + Full Variant Name in Order Lines

## Problem

1. **Rx Quantity on prescription PDF**: For injectables, the prescription shows `quantity: 1` (the order quantity), but the Rx quantity should be the **volume** extracted from the dosage label (e.g., `5mg/1mg/10mg/ml - 2mL` → Rx Qty = **2**). The order quantity (how many vials) is separate from the product/Rx quantity (the mL volume).

2. **Order Lines show generic product name**: The Order Details dialog shows only `line.products?.name` (e.g., "Semaglutide/Methylcobalamin/Glycine") without the variant strength/dosage. Need to show the full variant info (e.g., "Semaglutide/Methylcobalamin/Glycine 5mg/1mg/10mg/ml - 2mL").

## Changes

### 1. `supabase/functions/generate-prescription-pdf/index.ts`

**Extract Rx quantity from dosage label for injectables** (around line 274):

Parse the volume from `variantDosageLabel` using a regex like `/- (\d+)mL/i`. If found, use that number as the prescription quantity instead of `orderLine.quantity`.

```
// e.g. "5mg/1mg/10mg/ml - 2mL" → rxQuantity = 2
const mlMatch = variantDosageLabel?.match(/- (\d+)mL/i);
const rxQuantity = mlMatch ? parseInt(mlMatch[1]) : orderLine.quantity || 1;
...
quantity: rxQuantity,
```

This only applies to the `order_line_id` regeneration path. For the direct-call path (PrescriptionWriterDialog), the quantity is already passed explicitly — we need to apply the same logic there too.

### 2. `src/components/products/PrescriptionWriterDialog.tsx`

When building the prescription data to send to the edge function, extract the mL volume from the selected variant's `dosage_label` and use it as the `quantity` field on the prescription. The order quantity (number of vials) remains unchanged for pricing.

### 3. `supabase/functions/get-order-details/index.ts`

**Add variant_id join to fetch dosage_label** in the order query (line 101-128):

Add `variant_id` and a join to `product_variants` in the `order_lines` select:

```
order_lines (
  ...existing fields...,
  variant_id,
  product_variants (
    dosage_label
  ),
  ...
)
```

### 4. `src/components/orders/OrderDetailsDialog.tsx`

**Show full variant name** in order lines (line 918):

Change from:
```tsx
<p className="font-medium">{line.products?.name || "N/A"}</p>
```
To:
```tsx
<p className="font-medium">
  {line.products?.name || "N/A"}
  {line.product_variants?.dosage_label && (
    <span className="text-sm text-muted-foreground ml-1">
      {line.product_variants.dosage_label}
    </span>
  )}
</p>
```

### 5. Regenerate Renee Rodriguez's prescription

After deploying the edge function fix, regenerate the prescription for order line `95d9e316-3cf2-4a6c-8cd9-f54b348b80dd` so it shows the correct Rx quantity (2mL) instead of 1.

## Files Changed
- `supabase/functions/generate-prescription-pdf/index.ts` — extract mL volume as Rx quantity
- `supabase/functions/get-order-details/index.ts` — join product_variants for dosage_label
- `src/components/orders/OrderDetailsDialog.tsx` — display full variant name in order lines
- `src/components/products/PrescriptionWriterDialog.tsx` — use mL volume as Rx quantity for new prescriptions

