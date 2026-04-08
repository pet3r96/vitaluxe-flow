
# Fix: Order Details Still Shows "No Patient Address on File"

## What I found

The previous fix was incomplete. The UI can still show "No patient address on file" even when the patient does have an address.

### Root causes in code

1. `src/components/orders/OrderDetailsDialog.tsx` still renders the shipping address from the stale `order` prop:
   - It uses `order.formatted_shipping_address`
   - It uses `order.practice_address`
   - It uses `order.order_lines?.[0]?.id`

   But this dialog already fetches fresher data into `fullOrderDetails` / `orderData`.

2. `supabase/functions/get-order-details/index.ts` does **not** return:
   - `formatted_shipping_address`
   - `practice_address`

   So even the fresh details payload does not currently include the fields the dialog should rely on.

3. `supabase/functions/get-orders-page/index.ts` also omits those same address fields from the orders list payload, so the initial `selectedOrder` object opened in the dialog starts out missing them.

4. The PHI/contact fallback effect in `OrderDetailsDialog` also reads from `order.order_lines`, not the resolved full-details object, which makes the address lookup path less reliable than it should be.

## Implementation plan

### 1. Update `supabase/functions/get-order-details/index.ts`
Add these order fields to the select:
- `formatted_shipping_address`
- `practice_address`

This makes the full order details payload actually contain the shipping address fields.

### 2. Update `supabase/functions/get-orders-page/index.ts`
Add these fields to the base orders select:
- `formatted_shipping_address`
- `practice_address`

This ensures the dialog has address data immediately when opened from the orders table, even before the full-details fetch finishes.

### 3. Update `src/components/orders/OrderDetailsDialog.tsx`
Use a single resolved order object everywhere for shipping display logic, e.g. `const activeOrder = fullOrderDetails || order`.

Then switch the shipping card to use:
- `activeOrder.ship_to`
- `activeOrder.practice_address`
- `activeOrder.formatted_shipping_address`
- `activeOrder.order_lines?.[0]?.id`

### 4. Harden the address fallback in `OrderDetailsDialog.tsx`
Update the contact/decryption effect to use `activeOrder.order_lines` instead of `order.order_lines`, so the fallback address lookup stays aligned with the freshest order data.

### 5. Final fallback behavior
Keep this address priority for patient shipments:
1. decrypted order-line patient address
2. `activeOrder.formatted_shipping_address`
3. constructed address from `patientFallbackData`
4. only then show `"No patient address on file"`

## Why this should fix the screenshot issue

Right now, the dialog is effectively looking at the wrong object and the edge functions are not returning the address fields it needs. That means the UI can display "No patient address on file" even when the backend record is correct.

## Scope
- 3 files
- no schema change
- no migration required unless a specific historical order is later confirmed to truly have missing address data in the database

## Files to change
- `src/components/orders/OrderDetailsDialog.tsx`
- `supabase/functions/get-order-details/index.ts`
- `supabase/functions/get-orders-page/index.ts`
