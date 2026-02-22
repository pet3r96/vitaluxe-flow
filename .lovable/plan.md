

# Suite/Address Display & Persistence -- Complete Fix Plan

## Problem Summary
"Suite 275" is stored in the database (`address_suite: "suite 275"`, `shipping_address_suite: "suite 275"`) but is not showing up in several display locations and is being **silently dropped** when addresses are updated.

---

## Root Causes Found

### Issue 1: CRITICAL -- DeliveryConfirmation Drops Suite on Save
**File:** `src/pages/DeliveryConfirmation.tsx` (lines 92-105)

The `updatePracticeAddress` mutation saves every address field EXCEPT `shipping_address_suite`:

```
.update({
  shipping_address_street: address.street,
  shipping_address_city: address.city,
  shipping_address_state: address.state,
  shipping_address_zip: address.zip,
  shipping_address_formatted: address.formatted,
  // MISSING: shipping_address_suite: address.suite,
})
```

**Impact:** Every time a user updates their practice address from the Delivery Confirmation page, their suite number is erased from the database.

### Issue 2: CRITICAL -- DeliveryConfirmation Does Not Display Suite
**File:** `src/pages/DeliveryConfirmation.tsx` (lines 554-559)

The address display shows street, city, state, zip but no suite:

```
<div>{profile.shipping_address_street}</div>
<div>{profile.shipping_address_city}, {profile.shipping_address_state} {profile.shipping_address_zip}</div>
// No suite line
```

### Issue 3: CRITICAL -- place-order Queries Non-Existent `practices` Table
**File:** `supabase/functions/place-order/index.ts` (lines 264-271)

```
const { data: practice } = await supabaseAdmin
  .from("practices")           // <-- TABLE DOES NOT EXIST
  .select("shipping_address")  // <-- COLUMN ALSO DOESN'T EXIST ON profiles
  .eq("id", effectivePracticeId)
  .single();
```

The `practices` table does not exist in the database. The practice address lives in the `profiles` table under structured fields (`shipping_address_street`, `shipping_address_suite`, etc.). This means `practiceAddress` is always `null`, so every practice order is created with `practice_address: null` and `formatted_shipping_address: null`.

### Issue 4: HIGH -- formatPracticeAddress Utility Missing Suite
**File:** `src/lib/practiceUtils.ts` (lines 48-63)

The `formatPracticeAddress` function and `getPracticeDetails` both omit `address_suite` from both the query and the formatting logic.

### Issue 5: HIGH -- Multiple Display Locations Missing Suite

The following files construct address strings by concatenating `address_street, address_city, address_state address_zip` without including suite:

- `src/components/calendar/CreateAppointmentDialog.tsx` (line 331)
- `src/components/pharmacies/PharmacyShippingWorkflow.tsx` (line 537)
- `src/components/products/ProductsGrid.tsx` (line 698) -- patient address display
- `src/components/products/PrescriptionWriterDialog.tsx` (line 390)
- `src/pages/patient/PatientAppointments.tsx` (lines 107, 199) -- missing from select query

### Issue 6: MEDIUM -- Checkout defaultBillingAddress Missing Suite
**File:** `src/pages/Checkout.tsx` (lines 1313-1319)

The `AddCreditCardDialog` receives a `defaultBillingAddress` without the suite:
```
street: providerProfile.shipping_address_street,
city: providerProfile.shipping_address_city,
// Missing: suite: providerProfile.shipping_address_suite,
```

---

## Fix Plan

### Fix 1: DeliveryConfirmation -- Save Suite on Update
**File:** `src/pages/DeliveryConfirmation.tsx`

Add `shipping_address_suite: address.suite || null` to the `updatePracticeAddress` mutation (line 97-101).

### Fix 2: DeliveryConfirmation -- Display Suite
**File:** `src/pages/DeliveryConfirmation.tsx`

Add a suite line between street and city in the address display (around line 557):
```
<div>{profile.shipping_address_street}</div>
{profile.shipping_address_suite && <div>{profile.shipping_address_suite}</div>}
<div>{profile.shipping_address_city}, ...
```

### Fix 3: place-order -- Fix Practice Address Query
**File:** `supabase/functions/place-order/index.ts`

Change the query from the non-existent `practices` table to `profiles`, and select the structured address fields:
```
const { data: practice } = await supabaseAdmin
  .from("profiles")
  .select("shipping_address_street, shipping_address_suite, shipping_address_city, shipping_address_state, shipping_address_zip")
  .eq("id", effectivePracticeId)
  .single();

const practiceAddress = practice
  ? [practice.shipping_address_street, practice.shipping_address_suite, practice.shipping_address_city, practice.shipping_address_state, practice.shipping_address_zip].filter(Boolean).join(', ')
  : null;
```

### Fix 4: practiceUtils -- Include Suite
**File:** `src/lib/practiceUtils.ts`

Add `address_suite` to the select query in `getPracticeDetails` and include it in `formatPracticeAddress`.

### Fix 5: All Address Display Locations -- Include Suite
Update the following files to include suite in address formatting:
- `src/components/calendar/CreateAppointmentDialog.tsx`
- `src/components/pharmacies/PharmacyShippingWorkflow.tsx`
- `src/components/products/ProductsGrid.tsx`
- `src/components/products/PrescriptionWriterDialog.tsx`
- `src/pages/patient/PatientAppointments.tsx`

### Fix 6: Checkout -- Pass Suite to defaultBillingAddress
**File:** `src/pages/Checkout.tsx` (line 1315-1318)

Add `suite: providerProfile.shipping_address_suite` to the defaultBillingAddress object.

---

## Fix Summary

| # | File | Change | Severity |
|---|------|--------|----------|
| 1 | `src/pages/DeliveryConfirmation.tsx` | Save `shipping_address_suite` on address update | Critical |
| 2 | `src/pages/DeliveryConfirmation.tsx` | Display suite in address view | Critical |
| 3 | `supabase/functions/place-order/index.ts` | Query `profiles` instead of non-existent `practices` table, include suite | Critical |
| 4 | `src/lib/practiceUtils.ts` | Add `address_suite` to query and format function | High |
| 5 | 5 component files | Include suite in inline address formatting | High |
| 6 | `src/pages/Checkout.tsx` | Pass suite to defaultBillingAddress | Medium |

