

# Fix: patientSubscriptionCheck.ts -- Active Subscription Logic Bug

## Problem
`src/lib/patientSubscriptionCheck.ts` line 66-67 still checks `current_period_end > now` for active subscriptions. This contradicts the fix already applied to `subscriptionCheck.ts` where `status === 'active'` is always treated as subscribed. A patient whose practice has an active subscription but an expired `current_period_end` would incorrectly see their practice as unsubscribed, potentially blocking access to patient portal features.

## Fix
Change line 66 from:
```typescript
} else if (sub.status === 'active' && sub.current_period_end) {
    isSubscribed = new Date(sub.current_period_end) > now;
```
To:
```typescript
} else if (sub.status === 'active') {
    isSubscribed = true;
```

This aligns patient-side subscription checking with the practice-side logic.

## Files Changed
- `src/lib/patientSubscriptionCheck.ts` (line 66-67) -- 1 line change

## Verification
After this fix, all 3 subscription check paths are aligned:
1. `subscriptionCheck.ts` `hasActiveSubscription()` -- active = true
2. `subscriptionCheck.ts` `getSubscriptionStatus()` -- active = true
3. `patientSubscriptionCheck.ts` `getPatientPracticeSubscription()` -- active = true (after fix)
4. `get-practice-subscription-status` edge function -- active = true (already correct)

Everything else (shipping, email) passed the audit with no issues.
