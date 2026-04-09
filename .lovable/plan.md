

# Fix: Order Lines Using Stale Data Instead of Full Details

## Problem

Line 912 in `OrderDetailsDialog.tsx` renders order lines from `order.order_lines` (the original table prop) instead of `orderData.order_lines` (which includes `product_variants.dosage_label` from the edge function).

The component already fetches full details via `get-order-details` and stores it as `orderData` (line 297), but the Order Lines section still references the raw `order` prop.

## Fix

### `src/components/orders/OrderDetailsDialog.tsx` (line 912)

Change:
```tsx
{order.order_lines?.map((line: any) => (
```
To:
```tsx
{(orderData?.order_lines || order.order_lines)?.map((line: any) => (
```

This ensures the rendered order lines use the enriched data (with `product_variants.dosage_label`) when available, falling back to the original prop while loading.

## Scope
- 1 file, 1-line change
- No edge function changes needed — the data is already being fetched correctly

