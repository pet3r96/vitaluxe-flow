
# Complete Payment System Audit -- Final Report

## Current Database State
- Only 1 active card exists (Amex ending 79003 for practice 2feb9460...)
- It has valid numeric `authorizenet_profile_id: 796505386` and `authorizenet_payment_profile_id: 1348955647`
- It is correctly set as `is_default: true`
- All legacy/invalid cards have been properly marked as `removed` or `declined`

---

## CRITICAL BUG: `update-payment-method` Queries Wrong Column on providers/practice_staff

**File:** `supabase/functions/update-payment-method/index.ts` (lines 30-48)

The `resolvePracticeId` function queries:
```
.eq('status', 'active')   // line 33 (providers)
.eq('status', 'active')   // line 45 (practice_staff)
```

But both `providers` and `practice_staff` tables have a **boolean `active` column**, NOT a `status` column. This means these queries always return 0 rows, so:

- Staff and providers can NEVER set a default payment method (returns "No associated practice found")
- Only practice owners (where `role === 'practice'`) can manage cards via this function

**Fix:** Change both lines to `.eq('active', true)` to match the actual database schema.

Note: The `authorizenet-charge-payment` function already correctly uses `.eq('active', true)` for the same lookups -- only `update-payment-method` has this bug.

---

## What Passed Audit (Confirmed Working)

| Component | Status | Details |
|-----------|--------|---------|
| Accept.js tokenization | OK | Production keys, card data sanitized, Luhn validation available |
| `authorizenet-create-customer-profile` | OK | Numeric ID validation, correct table, proper error handling |
| `authorizenet-charge-payment` | OK | Retry logic, CSRF, correct staff/provider auth (uses `active: true`) |
| `authorizenet-refund-transaction` | OK | CSRF, proper order lookups |
| `place-order` | OK | Correct `practice_payment_methods` table, payment validation |
| `AddCreditCardDialog` | OK | Auto-default first card, predicate-based cache invalidation, passes practiceId |
| `Checkout.tsx` | OK | Passes `practiceIdForPayment` correctly to AddCreditCardDialog |
| `PaymentMethodManager` display | OK | Uses `card_last_five`, `card_expiry`, `card_type` |
| `PaymentMethodManager` add card | OK | Passes `practiceId`, uses queryClient invalidation |
| `MySubscription` | OK | Passes `effectivePracticeId` to PaymentMethodManager |
| Database data integrity | OK | Only card with valid Authorize.Net IDs is active, default is set |
| Card creation flow | OK | Tokenize -> edge function -> Authorize.Net API -> DB insert with numeric profile IDs |

## Card Creation Flow Verification

The end-to-end flow when adding a card:

1. Client calls `tokenizeCard()` via Accept.js -- gets opaque data token (never sends raw card to server)
2. Client sends token + metadata to `authorizenet-create-customer-profile` edge function
3. Edge function calls Authorize.Net API with opaque data to create/add profile
4. Authorize.Net returns numeric `customerProfileId` and `customerPaymentProfileId`
5. Edge function validates response `resultCode === 'Ok'` before proceeding
6. Edge function inserts into `practice_payment_methods` with the real numeric IDs
7. If Authorize.Net returns an error, the function returns a 400 with the error message -- no orphaned DB records

This flow guarantees that every active card in the database has a valid Authorize.Net profile, because the insert only happens AFTER a successful API response.

---

## Fix Summary

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | `update-payment-method` uses `.eq('status', 'active')` instead of `.eq('active', true)` for providers and practice_staff | Critical | `supabase/functions/update-payment-method/index.ts` lines 33, 45 |

Only 1 fix needed. Everything else is verified working.
