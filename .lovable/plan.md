

# Fix: "No Patients Found" When Patient Has No Email

## Problem

The "Add to Cart" dialog on the Products page filters out any patient that doesn't have an email address. Since the patient form allows adding patients without an email (which is correct -- not all patients have email), this creates a contradiction: a patient can be added successfully but then be invisible when ordering.

The newly added patient "TEST SMITH" has no email, so the filter on line 171-174 of `PatientSelectionDialog.tsx` removes them entirely.

## Fix

**File: `src/components/products/PatientSelectionDialog.tsx`** (lines 170-176)

Remove the email requirement from the patient filter. Only require that the patient has an `id` (which every database row will have). The email filter was added as a "safety guard" but is incorrect -- patients without email are valid for ordering.

Change:
```typescript
const validPatients = ((data || []) as unknown as PatientAccount[]).filter((patient) => {
  const hasEmail = !!patient.email;
  const hasId = !!patient.id;
  return hasEmail && hasId;
});
```

To:
```typescript
const validPatients = ((data || []) as unknown as PatientAccount[]).filter((patient) => {
  return !!patient.id;
});
```

This is the only change needed. One file, one line of logic.

## Why This Is Safe

- The `id` field is a primary key and always exists
- Email is already optional in the patient creation form
- Shipping address and other order details are handled separately in the cart flow
- If email is needed for order notifications, that should be checked at order submission time, not at patient selection time

