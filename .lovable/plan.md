

## Fix: Pass the correct VIOS product ID (Med ID) when submitting orders

### Problem
The order submission to VIOS always uses the product-level `vios_lf_product_id`, ignoring the variant-level `product_code`. Since the catalog was rebuilt with each variant storing its own specific Med ID, orders may be sent with the wrong (or missing) product identifier.

### Change: `supabase/functions/_shared/vios/viosOrders.ts`

Update the `lfProductId` resolution (around line 151) to prioritize the variant's `product_code`, falling back to the product's `vios_lf_product_id`:

```
Before:
  const viosProductId = orderLine.products?.vios_lf_product_id;

After:
  const viosProductId = orderLine.product_variants?.product_code
    || orderLine.products?.vios_lf_product_id;
```

This ensures:
1. If a variant has a `product_code` (Med ID), that is used (most common case with new catalog)
2. If not, falls back to the product-level `vios_lf_product_id`
3. The existing validation in `viosValidation.ts` (line 343) should also be updated to check both fields so it does not falsely flag orders as missing a VIOS ID

### Change: `supabase/functions/_shared/vios/viosValidation.ts`

Update the product ID validation (around line 343) to also check the variant's `product_code`:

```
Before:
  const viosProductId = orderLine.products?.vios_lf_product_id;

After:
  const viosProductId = orderLine.product_variants?.product_code
    || orderLine.products?.vios_lf_product_id;
```

### No other changes needed
- The `send-vios-order` edge function already queries `product_variants` with `product_code` in its select statement
- The `OrderLineData` type already includes `product_variants?.product_code`
- The logging in `submitViosOrder` already logs `hasLfProductId` which will still work correctly

