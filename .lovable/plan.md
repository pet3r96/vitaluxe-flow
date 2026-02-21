

# Fix Credit Card Add / Save / Display Issues

## Issues Found

### Issue 1: Subscription Page Shows Blank Card Details (Critical)
`PaymentMethodManager.tsx` (subscription page) uses `method.last_four`, `method.expiration_month`, and `method.expiration_year` -- but these fields don't exist in the database. The actual database columns are `card_last_five` and `card_expiry` (stored as "MM/YY"). This means cards display as "undefined ---- undefined" with "Expires undefined/undefined" on the subscription page.

### Issue 2: First Card Not Set as Default
`AddCreditCardDialog` always sends `is_default: false`. When a user adds their very first card, it should automatically become the default. Otherwise it won't show the "Default" badge and could cause confusion.

### Issue 3: Checkout Query Cache Not Refreshed After Adding Card (Staff/Provider)
The `AddCreditCardDialog` invalidates query key `['payment-methods', practiceId]` (where practiceId = effectiveUserId), but checkout uses a 3-part key `['payment-methods', practiceIdForPayment, user?.id]`. For staff/providers, `practiceIdForPayment !== effectiveUserId`, so the invalidation doesn't trigger a refetch. The newly added card won't appear until manual page refresh.

### Issue 4: Checkout AddCreditCardDialog Uses Wrong practiceId for Staff
Line 1322 passes `practiceId={effectiveUserId}` but should use `practiceIdForPayment` so staff cards are saved under the practice, not their personal account.

---

## Fixes

### Fix 1: PaymentMethodManager.tsx -- Map DB Fields Correctly
Update the component to use `card_last_five`, `card_expiry`, and `card_type` from the actual database columns:

```
Before: {method.card_type} •••• {method.last_four}
         Expires {method.expiration_month}/{method.expiration_year}

After:  {method.card_type} •••• {method.card_last_five}
         Expires {method.card_expiry}
```

Also update the `PaymentMethod` interface in this file to match the DB schema.

### Fix 2: AddCreditCardDialog -- Auto-Default First Card
Before sending the request, check if the user has any existing active cards. If none, set `is_default: true` automatically.

### Fix 3: AddCreditCardDialog -- Broader Query Invalidation
After successfully adding a card, invalidate all payment-methods queries (not just the one matching `practiceId`) using a predicate-based invalidation:
```
queryClient.invalidateQueries({ 
  predicate: (query) => query.queryKey[0] === 'payment-methods' 
});
```

### Fix 4: Checkout -- Pass Correct practiceId
Change line 1322 from `practiceId={effectiveUserId}` to `practiceId={practiceIdForPayment}` so staff/provider cards are saved under the correct practice.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/subscription/PaymentMethodManager.tsx` | Fix interface + field names to match DB columns |
| `src/components/profile/AddCreditCardDialog.tsx` | Auto-default first card + broader cache invalidation |
| `src/pages/Checkout.tsx` | Pass `practiceIdForPayment` to AddCreditCardDialog |

