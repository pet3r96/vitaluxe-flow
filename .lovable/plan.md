

# Fix: VIOS API Quantity Should Use Volume, Not Order Quantity

## Problem
The prescription PDF correctly shows the volume-based Rx quantity (e.g., `2` for a 2mL vial), but the VIOS pharmacy API payload still sends `quantity: "1"` (the order quantity) because `viosOrders.ts` line 211 uses `String(orderLine.quantity || 1)`.

VIOS requires quantity in **volume** (mL), not vial count — this is already documented in the validation function `validateVolumeQuantity`.

## Fix

### `supabase/functions/_shared/vios/viosOrders.ts` (~line 209-211)

Extract the mL volume from `product_variants.dosage_label` (already available on the order line data) and use it as the quantity. Fall back to `orderLine.quantity` if no mL pattern is found.

```typescript
// Before line 209, extract volume from dosage label
const dosageLabel = orderLine.product_variants?.dosage_label || '';
const mlMatch = dosageLabel.match(/[\-–]\s*(\d+)\s*mL/i);
const rxQuantity = mlMatch ? parseInt(mlMatch[1]) : (orderLine.quantity || 1);

// Line 211 changes from:
quantity: String(orderLine.quantity || 1),
// To:
quantity: String(rxQuantity),
```

This ensures the API payload matches what the PDF shows and what VIOS expects (volume-based quantity).

## Scope
- 1 file changed: `supabase/functions/_shared/vios/viosOrders.ts`
- Deploy edge functions after change
- No database changes needed

