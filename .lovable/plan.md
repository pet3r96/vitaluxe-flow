
# Fix: Terms Acceptance and Trial Enrollment Bypass

## Problem

When a new practice (doctor) signs in for the first time, two things happen in a race:

1. `fetchUserRole` runs and checks `user_terms_acceptances` for ANY record -- this determines if terms were accepted
2. Auto-enrollment calls `subscribe-to-vitaluxepro`, which creates a subscription AND inserts a `user_terms_acceptances` record with `role = 'subscription'`

Because the terms check (step 1) looks for ANY acceptance record regardless of role, the subscription acceptance record satisfies it. The user is never shown the actual Practice Agreement terms.

Additionally, auto-enrollment happens silently in the background without the user ever seeing the trial enrollment page or agreeing to anything.

## Fix (2 Parts)

### Part 1: Make terms check role-specific

**File: `src/contexts/AuthContext.tsx`** (parallel query, ~line 914-920)

Change the terms acceptance query to filter by the user's actual role. Instead of:

```
.eq('user_id', userId)
```

Add a role filter:

```
.eq('user_id', userId)
.eq('role', role)  // Only check terms for the user's actual role
```

This applies to both the parallel query and the impersonation branch (~line 1029-1034). The role variable is already resolved by the time these queries run.

This ensures that a `subscription` terms record does not satisfy the `doctor` terms requirement.

### Part 2: Move auto-enrollment AFTER terms acceptance

**File: `src/contexts/AuthContext.tsx`** (~line 447-497)

Remove the auto-enrollment block from the `SIGNED_IN` handler. Instead, trigger auto-enrollment from the `AcceptTerms` page after the user successfully accepts their role-specific terms.

**File: `src/pages/AcceptTerms.tsx`** (~line 203-227)

After terms are accepted successfully (inside the `if (data.success)` block), check if the user is a `doctor` role and auto-enroll them in a trial if they don't already have a subscription:

```typescript
// Auto-enroll practice in trial after terms acceptance
if (effectiveRole === 'doctor') {
  try {
    const { error: subError } = await supabase.functions.invoke('subscribe-to-vitaluxepro');
    if (!subError) {
      toast.success("Your 14-day free trial has started!");
    }
  } catch (e) {
    // Non-blocking - trial can be started later
  }
}
```

## Summary of Changes

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Add `.eq('role', role)` to terms query (2 places); Remove auto-enrollment from SIGNED_IN handler |
| `src/pages/AcceptTerms.tsx` | Add auto-enrollment after successful terms acceptance for doctor role |

## Expected Flow After Fix

1. New doctor signs up and verifies email
2. Doctor logs in
3. Terms check finds no `doctor` terms acceptance record -- redirects to `/accept-terms`
4. Doctor reads and signs the Practice Agreement
5. After signing, trial auto-enrolls silently
6. Doctor lands on dashboard with "Trial: 14 days remaining"
