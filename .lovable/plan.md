

# Complete Payment System Audit -- Findings & Fixes

## Audit Scope
Reviewed every file in the payment flow: card entry, tokenization, profile creation, charging, refunds, checkout, subscription management, and database records.

---

## CRITICAL FINDING 1: No Practice Has a Default Payment Method

**Database evidence:** All 3 practices with active cards have `is_default = false` on every card. Zero defaults exist anywhere.

| Practice | Active Cards | Default Cards |
|----------|-------------|---------------|
| 2feb9460... | 3 | 0 |
| 9684f7bc... | 1 | 0 |
| f4ced413... | 1 | 0 |

**Root cause:** The auto-default fix was applied to `AddCreditCardDialog` code, but all existing cards were added before that fix. No migration was run to set defaults for existing data.

**Fix:** Run a SQL migration that sets `is_default = true` for the oldest active card per practice (where no default exists):

```sql
UPDATE practice_payment_methods SET is_default = true
WHERE id IN (
  SELECT DISTINCT ON (practice_id) id
  FROM practice_payment_methods
  WHERE status = 'active'
  AND practice_id NOT IN (
    SELECT practice_id FROM practice_payment_methods WHERE is_default = true AND status = 'active'
  )
  ORDER BY practice_id, created_at ASC
);
```

---

## CRITICAL FINDING 2: 4 of 5 Active Cards Have No Authorize.Net Profile ID

**Database evidence:** Only 1 card (Amex ending 79003) has a real numeric `authorizenet_profile_id`. The other 4 active cards have `NULL` for `authorizenet_profile_id` and fake values like `payment_1763620195590_0awl68p8n` for `authorizenet_payment_profile_id`.

**Impact:** When `place-order` tries to charge these cards via `authorizenet-charge-payment`, the API call will fail because there is no valid Authorize.Net customer profile to charge against. The `createTransactionRequest` requires a real `customerProfileId` and `paymentProfileId`.

**Fix:** These are legacy/test cards that need to be cleaned up. Run a migration to mark cards without valid numeric profile IDs as `removed`:

```sql
UPDATE practice_payment_methods 
SET status = 'removed' 
WHERE status = 'active' 
AND (authorizenet_profile_id IS NULL OR authorizenet_profile_id !~ '^\d+$');
```

Then re-run the default assignment query above for practices that lost their only active card.

---

## HIGH: `update-payment-method` Edge Function Broken for Staff/Providers

**File:** `supabase/functions/update-payment-method/index.ts` (lines 50-55, 64-69)

The function checks `practice_id = user.id` when verifying ownership (line 54) and when unsetting defaults (line 69). For staff and providers, `user.id` is their personal auth ID, not the practice ID. This means:

- Staff cannot set default on practice cards (returns 404 "Payment method not found")
- Even if they could, the unset-defaults query would only unset cards under `user.id` (wrong practice)

**Fix:** Look up the user's practice membership (via `providers` or `practice_staff` table) and use that practice ID for both the ownership check and default management. This mirrors the authorization logic already used in `authorizenet-charge-payment`.

---

## MEDIUM: `PaymentMethodManager` Still Uses `window.location.reload()`

**File:** `src/components/subscription/PaymentMethodManager.tsx` (line 175)

After adding a card, the component does a full page reload instead of invalidating the query. This causes poor UX (flash, loss of scroll position) and doesn't integrate with React Query.

**Fix:** Replace `window.location.reload()` with React Query invalidation:
```typescript
onSuccess={() => {
  queryClient.invalidateQueries({ 
    predicate: (query) => query.queryKey[0] === 'payment-methods' || query.queryKey[0] === 'subscription-data'
  });
}}
```
This requires passing `queryClient` or wrapping in a hook.

---

## What Passed Audit (Working Correctly)

| Component | Status |
|-----------|--------|
| Accept.js tokenization (client-side) | OK -- production keys, proper card data sanitization |
| `authorizenet-create-customer-profile` edge function | OK -- correct table, numeric ID validation, proper insert |
| `authorizenet-charge-payment` edge function | OK -- retry logic, CSRF validation, staff/provider auth checks |
| `authorizenet-refund-transaction` edge function | OK -- proper refund flow, idempotency check, correct table joins |
| `place-order` edge function | OK -- uses `practice_payment_methods` (fixed), payment-first flow, rollback on failure |
| `Checkout.tsx` payment method query | OK -- correct table, correct `practiceIdForPayment`, auto-select default |
| `Checkout.tsx` AddCreditCardDialog | OK -- passes `practiceIdForPayment` correctly |
| `AddCreditCardDialog` auto-default logic | OK -- checks for existing active cards before defaulting |
| `AddCreditCardDialog` cache invalidation | OK -- predicate-based invalidation covers all payment-methods queries |
| `PaymentMethodManager` card display | OK -- uses `card_last_five`, `card_expiry`, `card_type` |
| `MySubscription` practiceId pass-through | OK -- passes `effectivePracticeId || user?.id` |
| Card type detection (Luhn, BIN lookup) | OK -- covers Visa, MC, Amex, Discover |
| CSRF protection on all payment functions | OK -- validated in charge, refund, update, place-order |
| Rate limiting on payment functions | OK -- 5 charges/hr, 20 orders/hr |

---

## Fix Summary

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 1 | No default payment methods in database | Critical | SQL migration |
| 2 | 4/5 active cards have invalid Authorize.Net profiles (will fail on charge) | Critical | SQL migration |
| 3 | `update-payment-method` broken for staff/providers | High | `supabase/functions/update-payment-method/index.ts` |
| 4 | `PaymentMethodManager` uses `window.location.reload()` | Medium | `src/components/subscription/PaymentMethodManager.tsx` |

