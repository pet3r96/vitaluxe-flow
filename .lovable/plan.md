
# Fix: Practice Orders Using Patient Address Instead of Practice Address

## Problem
When you link a patient to a "Ship to Practice" order, the patient's name replaces "Practice Order" in the cart line. The Delivery Confirmation page uses `patient_name === "Practice Order"` to determine whether to show the practice address or ask for a patient address. Since the name is now "Demo Patient 1" instead of "Practice Order", the system treats it as a patient shipment and tries to use/request the patient's address.

## Root Cause
There is no explicit `ship_to` field on `cart_lines`. The system relied on a naming convention (`patient_name = "Practice Order"`) which breaks when a real patient is linked.

## Solution
Add a `ship_to` column to the `cart_lines` table (values: `'practice'` or `'patient'`) so the system can reliably distinguish shipping destination regardless of patient name.

### 1. Database Migration -- Add `ship_to` column to `cart_lines`
- Add column `ship_to TEXT DEFAULT 'patient'` to `cart_lines`
- Backfill existing rows: set `ship_to = 'practice'` where `patient_name = 'Practice Order'`
- This also flows naturally to orders since `place-order` already copies cart line data

### 2. ProductsGrid.tsx -- Set `ship_to` when adding to cart
In the practice order block (line 662), add `shipTo: 'practice'` to the manage-cart body.
In the patient order block, add `shipTo: 'patient'`.

### 3. manage-cart Edge Function -- Persist `ship_to`
Update the `add` action to save the new `ship_to` field from the request body to the `cart_lines` row.

### 4. DeliveryConfirmation.tsx -- Use `ship_to` field instead of name check
Change line 372 from:
```
const isPracticeOrder = (line: any) => !line.patient_name || line.patient_name === "Practice Order";
```
To:
```
const isPracticeOrder = (line: any) => line.ship_to === 'practice' || (!line.patient_name || line.patient_name === "Practice Order");
```
The fallback keeps backward compatibility with existing cart lines that don't have `ship_to` set yet.

### 5. get-cart Edge Function -- Include `ship_to` in select
The `get-cart` function selects `*` from `cart_lines`, so `ship_to` will be included automatically. No change needed.

### 6. Checkout.tsx -- Pass `ship_to` to order creation
Ensure the `ship_to` value from cart lines flows through to the created orders so order management also knows the shipping type.

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | Database | Add `ship_to` column to `cart_lines`, backfill existing data |
| 2 | `src/components/products/ProductsGrid.tsx` | Pass `shipTo: 'practice'` or `'patient'` to manage-cart |
| 3 | `supabase/functions/manage-cart/index.ts` | Save `ship_to` field on cart line insert |
| 4 | `src/pages/DeliveryConfirmation.tsx` | Use `line.ship_to === 'practice'` with fallback |
| 5 | `src/pages/Checkout.tsx` | Pass `ship_to` from cart line to order |

## What Does NOT Change
- Shipping address logic: practice orders still ship to practice address from `profiles.shipping_address_*`
- Patient orders still ship to patient address
- The "Link to Patient" dropdown still works -- it just sets `patient_id` and `patient_name` while `ship_to` remains `'practice'`
- No changes to `calculate-shipping`, `place-order`, or any pharmacy API integrations
