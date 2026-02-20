

# Fix: Body Preserve Free Subscription + Replace Shipping Options (Ground -> Priority + First Class)

## 1. Body Preserve Free Pro Subscription

### Current State
- Practice ID: `4a6ca268-c18e-44bb-9213-80183fdd1726`
- Status: `trial` (expires Mar 6, 2026)
- Monthly price: `$0.00`

### Problem
Even though price is $0, the status is `trial` which will expire in 13 days. After that, Body Preserve loses access to Pro features.

### Fix
- Update the subscription record: set `status` to `active`, set `current_period_start` to now, set `current_period_end` to far future (2099-12-31)
- The existing auto-renewal logic in `subscriptionCheck.ts` already treats `status: 'active'` as always subscribed regardless of period end
- Combined with `monthly_price: 0`, they will never be billed and never lose access

---

## 2. Shipping Speed Changes: Remove Ground, Add Priority + First Class

### Scope of Changes
The shipping speed system touches **every layer** -- database enums, constraints, edge functions, validators, and UI components. All references to `ground` must be removed, and `priority` + `first_class` must be added.

### Database Migration

**Enum modification:**
```sql
ALTER TYPE shipping_speed ADD VALUE 'priority';
ALTER TYPE shipping_speed ADD VALUE 'first_class';
```
Note: Postgres does not allow removing enum values. Old `ground` value stays in the enum but will no longer be used by any code. Existing orders with `ground` shipping will retain their historical data.

**CHECK constraint on `order_lines`:**
- Drop the existing `valid_shipping_speed` CHECK constraint
- Recreate it with: `CHECK (shipping_speed IN ('2day', 'overnight', 'priority', 'first_class'))`

**Default values:**
- Update any default values from `'ground'` to `'priority'` on `cart_lines` and `order_lines`

### Frontend Changes (6 files)

1. **`src/components/cart/ShippingSpeedSelector.tsx`**
   - Remove `ground` option
   - Add `priority` option (icon: Truck, label: "Priority Shipping", desc: "(2-3 business days)")
   - Add `first_class` option (icon: Mail/Package, label: "First Class", desc: "(3-5 business days)")
   - Update all type references from `'ground' | '2day' | 'overnight'` to `'overnight' | '2day' | 'priority' | 'first_class'`

2. **`src/components/pharmacies/PharmacyShippingRatesDialog.tsx`**
   - Replace `ground` rate input with `priority` and `first_class` inputs
   - Update state, types, and save mutation

3. **`src/pages/Cart.tsx`**
   - Update all type references and default fallbacks from `'ground'` to `'first_class'` (cheapest option)
   - Update normalization logic to use new speed values
   - Priority order for auto-select: `overnight` -> `2day` -> `priority` -> `first_class`

4. **`src/components/orders/OrderDetailsDialog.tsx`**
   - Update display labels: add `priority` -> "Priority Shipping" and `first_class` -> "First Class"
   - Keep `ground` label as fallback for historical orders

5. **`src/components/orders/OrdersDataTable.tsx`**
   - Same display label updates for the orders table

6. **`src/components/pharmacies/PharmacyShippingWorkflow.tsx`**
   - Update shipping speed display labels

### Edge Function Changes (5 files)

1. **`supabase/functions/calculate-shipping/index.ts`**
   - Update `CalculateShippingRequest` type
   - Update default fallback rates: replace `ground` with `priority` and `first_class`

2. **`supabase/functions/update-shipping-speed/index.ts`**
   - No type validation to update (it accepts any string), but logging references should be updated

3. **`supabase/functions/place-order/index.ts`**
   - Update the `invalidShippingSpeeds` validation check to use new values

4. **`supabase/functions/_shared/requestValidators.ts`**
   - Update `validateCalculateShippingRequest` to accept `['overnight', '2day', 'priority', 'first_class']`

5. **`supabase/functions/_shared/vios/viosConfig.ts`**
   - Add mappings for `priority` and `first_class` to VIOS shipping codes
   - `priority` -> USPS Priority (7615)
   - `first_class` -> will need a VIOS code (user may need to configure this, or map to USPS Priority as default)
   - Remove/deprecate `ground` mapping

### Hook Changes (2 files)

1. **`src/hooks/useMultiplePharmacyRates.ts`** - No code changes needed (already generic)
2. **`src/hooks/usePharmacyShippingRates.ts`** - No code changes needed (already generic)

### Supabase Types
- `src/integrations/supabase/types.ts` will auto-update after migration to include `'priority'` and `'first_class'` in the shipping_speed enum

---

## 3. Data Migration for Existing Shipping Rates

Any existing pharmacy shipping rates with `ground` speed will need to be handled. Options:
- Leave existing `ground` rates in the database (they won't appear in UI anymore)
- The pharmacy admin will need to configure new `priority` and `first_class` rates via the shipping rates dialog

---

## Summary of All Changes

| Area | File | Change |
|------|------|--------|
| Data | practice_subscriptions | Body Preserve: status -> active, period -> 2099 |
| DB Migration | shipping_speed enum | Add `priority`, `first_class` values |
| DB Migration | order_lines constraint | Update CHECK to new values |
| DB Migration | cart_lines default | Change default from ground to first_class |
| Frontend | ShippingSpeedSelector.tsx | Replace ground with priority + first_class |
| Frontend | PharmacyShippingRatesDialog.tsx | Replace ground with priority + first_class inputs |
| Frontend | Cart.tsx | Update types, defaults, normalization |
| Frontend | OrderDetailsDialog.tsx | Update display labels |
| Frontend | OrdersDataTable.tsx | Update display labels |
| Frontend | PharmacyShippingWorkflow.tsx | Update display labels |
| Edge Fn | calculate-shipping | Update types and default rates |
| Edge Fn | place-order | Update validation |
| Edge Fn | requestValidators.ts | Update allowed values |
| Edge Fn | viosConfig.ts | Add VIOS code mappings for priority + first_class |
| Edge Fn | update-shipping-speed | No changes needed |

