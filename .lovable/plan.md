

# Full Audit: Shipping Options, Subscription Module, and Email Edge Function

## Audit 1: Shipping Options -- 3 Issues Found

### Issue A: OrderDetailsDialog still shows "Ground" as fallback (CRITICAL)
`src/components/orders/OrderDetailsDialog.tsx` at line 836-838 still has old labels:
```
{line.shipping_speed === '2day' ? '2-Day Shipping' :
 line.shipping_speed === 'overnight' ? 'Overnight Shipping' :
 'Ground (5-7 days)'}
```
This means any order with `priority` or `first_class` shipping will display as "Ground (5-7 days)". Fix: add `priority` and `first_class` labels, keep `ground` as a historical fallback.

### Issue B: Checkout.tsx still shows "Ground" as fallback
`src/pages/Checkout.tsx` at lines 900-901 and 976-978, the shipping speed badge falls through to `'Ground'` for any speed that isn't `overnight`, `2day`, `priority`, or `first_class`. The ternary chain ends with `'Ground'` instead of a proper label. Fix: the fallback should say "Standard" or handle all 4 speeds properly.

### Issue C: PharmacyShippingWorkflow.tsx still shows "Ground" as fallback
`src/components/pharmacies/PharmacyShippingWorkflow.tsx` at line 512 falls through to `'Ground'` for unrecognized speeds. Fix: same pattern -- add `priority` and `first_class` labels.

### Verified Working (no issues)
- ShippingSpeedSelector.tsx -- 4 options correctly defined
- PharmacyShippingRatesDialog.tsx -- 4 options, saves correctly
- Cart.tsx -- normalizes `ground` to `first_class`, auto-selects correctly
- calculate-shipping edge function -- accepts all 4 + ground fallback
- place-order edge function -- defaults to `first_class`
- requestValidators.ts -- accepts all 4 + ground
- viosConfig.ts -- maps `priority` and `first_class` to USPS_PRIORITY
- viosOrders.ts -- uses `getViosShippingCode()` correctly
- DeliveryConfirmation.tsx -- has all 4 labels

### VIOS Service Codes
The `pharmacy_shipping_rates` table has `vios_service_code = null` for `priority` and `first_class` entries. However, the system uses `getViosShippingCode()` from `viosConfig.ts` which maps based on the speed string, not the DB column. So VIOS orders will still work -- `priority` and `first_class` both map to USPS_PRIORITY (7615). No action needed.

---

## Audit 2: Subscription Module -- 2 Issues Found

### Issue A: `hasActiveSubscription()` contradicts main logic (BUG)
The `hasActiveSubscription()` function (line 62-64) checks `current_period_end > now` for active subscriptions. But `getSubscriptionStatus()` (line 114-118) treats all active subscriptions as always subscribed regardless of period end. This inconsistency means `shouldShowUpgradePrompt()` (which calls `hasActiveSubscription`) could incorrectly show upgrade prompts to active subscribers whose period technically expired but status is still active.

For Body Preserve this isn't an issue (period ends 2099), but for the other active practice (`2feb9460`) whose period ended Jan 11, 2026, `hasActiveSubscription` returns `false` even though `getSubscriptionStatus` returns `isSubscribed: true`.

Fix: align `hasActiveSubscription` with `getSubscriptionStatus` -- active status means subscribed, period end is irrelevant.

### Issue B: Body Preserve subscription -- VERIFIED CORRECT
- Status: `active`
- Monthly price: `$0.00`
- Period end: `2099-12-31`
- The auto-extend logic will never trigger (period end is in the far future)
- `getSubscriptionStatus` returns `isSubscribed: true`
- No billing mechanism exists in the code that would charge $0 users
- All other practices have `monthly_price: 149.99`
- The pricing constant `PRO_MONTHLY_PRICE = 149.99` is used everywhere for new signups
- No special "free plan" flag is needed -- the $0 price + active status + 2099 period is sufficient

### Other Subscriptions -- Safe
- Practice `f4ced413`: trial, $149.99, trial expired (Nov 13, 2025) -- correctly shows as not subscribed
- Practice `2feb9460`: active, $149.99, period end Jan 11, 2026 -- getSubscriptionStatus correctly returns subscribed, but hasActiveSubscription incorrectly returns false

---

## Audit 3: Email Edge Functions -- VERIFIED WORKING

### send-verification-email
- Accepts email-only requests (falls back to profile lookup for userId)
- Generates 24-hour tokens
- Uses unified-email-sender
- Proper error handling and audit logging
- No issues found

### verify-email
- Not modified, confirmed working in previous audit

---

## Implementation Plan

### File 1: `src/components/orders/OrderDetailsDialog.tsx` (line 836-838)
Update the shipping speed label to handle all 4 speeds:
```
{line.shipping_speed === '2day' ? '2-Day Shipping' :
 line.shipping_speed === 'overnight' ? 'Overnight Shipping' :
 line.shipping_speed === 'priority' ? 'Priority Shipping' :
 line.shipping_speed === 'first_class' ? 'First Class' :
 'Ground (historical)'}
```

### File 2: `src/pages/Checkout.tsx` (lines 900-901 and 976-978)
Update both shipping badge fallbacks to include priority and first_class labels, with a generic fallback instead of "Ground".

### File 3: `src/components/pharmacies/PharmacyShippingWorkflow.tsx` (line 512)
Update the shipping speed label to include priority and first_class.

### File 4: `src/lib/subscriptionCheck.ts` (lines 62-64)
Fix `hasActiveSubscription` to treat `status === 'active'` as always subscribed (matching `getSubscriptionStatus` logic):
```typescript
if (subscription.status === 'active') {
  return true;
}
```

---

## Summary

| Area | Issue | Severity | Fix |
|------|-------|----------|-----|
| OrderDetailsDialog | Shows "Ground" for priority/first_class | High | Update label chain |
| Checkout.tsx | Shows "Ground" for priority/first_class | High | Update label chain |
| PharmacyShippingWorkflow | Shows "Ground" for priority/first_class | Medium | Update label chain |
| subscriptionCheck.ts | hasActiveSubscription contradicts main logic | Medium | Align with getSubscriptionStatus |
| Body Preserve subscription | Correctly configured | None | No change needed |
| Email edge functions | Working correctly | None | No change needed |
| VIOS shipping codes | Working via config mapping | None | No change needed |

