

# Fix: Include Suite in Both Address Copy Buttons

## Problem

Both "Copy from Practice" and "Copy from Shipping" buttons in the Practice Profile form skip the `suite` (Apt/Unit) field when copying addresses. So if a practice address has "Suite 300", it gets lost when copied to shipping or billing.

## Fix

**File: `src/components/profile/PracticeProfileForm.tsx`**

**1. "Copy from Practice" button (line 477)** -- add `suite`:
```typescript
form.setValue('shipping_address', {
  street: practiceAddr.street,
  suite: practiceAddr.suite,   // <-- add
  city: practiceAddr.city,
  state: practiceAddr.state,
  zip: practiceAddr.zip,
});
```

**2. "Copy from Shipping" button (line 523)** -- add `suite`:
```typescript
form.setValue('billing_address', {
  street: shippingAddr.street,
  suite: shippingAddr.suite,   // <-- add
  city: shippingAddr.city,
  state: shippingAddr.state,
  zip: shippingAddr.zip,
});
```

Two lines added, one file changed. Both copy buttons will now carry the suite/unit field through.
