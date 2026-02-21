
# Credit Card Flow -- Complete Audit & Fix Plan

## Issues Found

### Issue 1: CRITICAL -- `place-order` Edge Function Queries Non-Existent Table
**File:** `supabase/functions/place-order/index.ts` (lines 338-342)

The code queries `"payment_methods"` table, but this table does NOT exist in the database. The correct table is `"practice_payment_methods"`.

```
// CURRENT (BROKEN):
const { data: selectedPaymentMethod } = await supabaseAdmin
  .from("payment_methods")        // <-- WRONG TABLE
  .select("payment_type")
  .eq("id", payment_method_id)
  .single();
```

**Impact:** `selectedPaymentMethod` is always `null`, so `payment_method_used` is stored as `null` on every order. This is a data integrity issue -- order records don't properly track which payment type was used. The payment itself still processes because the actual charge logic (lines 94-129) correctly queries `practice_payment_methods`.

**Fix:** Change `"payment_methods"` to `"practice_payment_methods"`.

---

### Issue 2: PaymentMethodManager Does Not Pass `practiceId` to AddCreditCardDialog
**File:** `src/components/subscription/PaymentMethodManager.tsx` (line 168-175)

The `AddCreditCardDialog` is rendered without a `practiceId` prop:
```
<AddCreditCardDialog
  open={showAddCard}
  onOpenChange={setShowAddCard}
  onSuccess={() => { window.location.reload(); }}
  // NO practiceId passed!
/>
```

**Impact:** 
1. The auto-default-first-card logic (lines 60-69 in AddCreditCardDialog) is **skipped** because `practiceId` is falsy, meaning `shouldBeDefault` stays `false`. The first card added via the subscription page will NOT be set as default.
2. The edge function receives no `practice_id` in the request body, so the card may be saved under `user.id` (the auth user) instead of the practice. For practice owners this is fine (user.id === practice_id), but for staff/providers this would be wrong.

**Fix:** Pass the current user's practice ID to `PaymentMethodManager` and forward it to `AddCreditCardDialog`. The component needs to accept a `practiceId` prop.

---

### Issue 3: PaymentMethodManager Uses Local State Instead of React Query
**File:** `src/components/subscription/PaymentMethodManager.tsx` (line 32-33)

The component copies `initialMethods` into local state and never refetches. After adding a card, it does `window.location.reload()` which is a poor UX pattern. Also, if the parent doesn't re-render with updated props, the state becomes stale.

**Fix:** This is a UX improvement (not blocking), but the `onSuccess` callback should invalidate the subscription query instead of doing a full page reload.

---

## Fix Summary

| # | File | Change | Severity |
|---|------|--------|----------|
| 1 | `supabase/functions/place-order/index.ts` | Change `"payment_methods"` to `"practice_payment_methods"` on line 339 | Critical |
| 2 | `src/components/subscription/PaymentMethodManager.tsx` | Accept `practiceId` prop and pass it to `AddCreditCardDialog` | High |
| 3 | `src/pages/practice/MySubscription.tsx` | Pass `practiceId` (effectivePracticeId or user.id) to `PaymentMethodManager` | High |

## What Already Works Correctly

- **AddCreditCardDialog** (Checkout path): Correctly receives `practiceId={practiceIdForPayment}` from Checkout.tsx (line 1322)
- **Card tokenization**: Accept.js integration is properly configured
- **Edge function `authorizenet-create-customer-profile`**: Correctly inserts into `practice_payment_methods` with all fields
- **Checkout payment method query**: Correctly queries `practice_payment_methods` with proper filtering
- **Auto-select default**: Checkout auto-selects the first active/default card
- **Cache invalidation**: Uses predicate-based invalidation that covers all payment-methods queries
- **Card display at checkout**: Correctly uses `card_last_five`, `card_expiry`, `card_type`
- **Card display on subscription page**: Correctly maps to DB columns after previous fix
- **Payment charging**: `authorizenet-charge-payment` is correctly invoked with proper payment method ID
- **Payment validation**: place-order validates payment method exists and is active (lines 94-129) against the correct `practice_payment_methods` table
