

# Fix: Suite/Apt Database Persistence + Allergy & Address Error Audit

## Problem
The suite/apt/unit field was added to the UI and edge function, but **no database columns exist** to store it. The suite value is captured in the frontend but silently dropped on every save across all address entry points: profiles, patient accounts, pharmacies, and orders.

## Root Cause
Three database tables store structured addresses but lack a `suite` column:
- `profiles` -- has `address_street`, `address_city`, etc. but NO `address_suite` or `shipping_address_suite`
- `patient_accounts` -- has `address_street`, `address_city`, etc. but NO `address_suite`
- `pharmacies` -- has `address_street`, `address_city`, etc. but NO `address_suite`

## Allergy Audit
The allergy system (`AllergyDialog`, `AllergiesSection`, `insertVaultRecord`) is **working correctly**. Allergy data does not involve addresses at all -- it writes to `patient_medical_vault` with JSONB `record_data`. The `practice_id` is auto-fetched from `patient_accounts`. No errors found in the allergy add/edit/delete flow for providers, practices, or patients.

## Solution

### Step 1: Add suite columns to all address tables (Database Migration)

Add the following columns:
```sql
-- profiles table (practice address + shipping address)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_suite TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shipping_address_suite TEXT;

-- patient_accounts table
ALTER TABLE public.patient_accounts ADD COLUMN IF NOT EXISTS address_suite TEXT;

-- pharmacies table
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS address_suite TEXT;
```

All columns are nullable TEXT -- suite is never required.

### Step 2: Update all save points to persist suite

**Files to update (6 total):**

1. **`src/components/profile/PracticeProfileForm.tsx`** (lines 136-154)
   - Add `address_suite: values.address?.suite` to the profile update mutation
   - Add `shipping_address_suite: values.shipping_address?.suite` to the shipping address save

2. **`src/components/profile/PharmacyProfileForm.tsx`** (line 145-151)
   - Add `address_suite: values.address.suite` to the pharmacy update mutation

3. **`src/components/patients/PatientDialog.tsx`** (lines 323-330)
   - Add `address_suite: formData.address_suite || null` to patient create/update
   - Add `address_suite` to formData state and load from existing patient data

4. **`src/pages/Auth.tsx`** (signup flow)
   - Include `suite` from `AddressValue` when passing address data to `assign-user-role` for practice/pharmacy signup

5. **`src/components/orders/DeliveryAddressEditor.tsx`**
   - Pass `suite` through the `AddressValue` on save

6. **`src/pages/Checkout.tsx`** (lines 144-150)
   - Fetch and use `shipping_address_suite` when loading practice shipping address

### Step 3: Suite is always optional

- The `AddressValue.suite` field is already typed as `suite?: string` (optional)
- No validation requires suite -- the "Save" button logic only checks street, city, state, zip
- The database columns are nullable TEXT -- no NOT NULL constraint
- The suite field placeholder already says "(optional)"

### Step 4: Verify edge function suite handling

The `google-validate-address` edge function already handles suite correctly (from previous implementation). It:
- Accepts `suite` in the request body
- Combines `street + suite` for Google API validation
- Preserves `suite` in all response paths
- No changes needed here

## Summary of Changes

| File | Change |
|------|--------|
| Database migration | Add `address_suite` to `profiles`, `patient_accounts`, `pharmacies`; add `shipping_address_suite` to `profiles` |
| `PracticeProfileForm.tsx` | Save `address_suite` and `shipping_address_suite` |
| `PharmacyProfileForm.tsx` | Save `address_suite` |
| `PatientDialog.tsx` | Save and load `address_suite` |
| `Auth.tsx` | Include suite in signup address data |
| `DeliveryAddressEditor.tsx` | Pass suite through on save |
| `Checkout.tsx` | Fetch and use `shipping_address_suite` |

## What is NOT changing
- Allergy system -- working correctly, no address involvement
- Suite field remains optional everywhere
- Edge function -- already handles suite
- `GoogleAddressAutocomplete` component -- already captures suite

