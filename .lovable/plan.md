

# Fix: Suite/Apt Persistence Gaps Across System

## Problems Found

The database columns exist (`address_suite` on profiles, patient_accounts, pharmacies; `shipping_address_suite` on profiles), and the frontend `AddressValue` type includes `suite`. However, **5 gaps** prevent suite from flowing end-to-end:

### Gap 1: PracticeProfileForm Zod schema strips suite
The Zod validation schema for `address` and `shipping_address` objects does not include `suite`, so Zod silently drops it before the mutation runs. The form also does not load `suite` from the profile when populating fields.

### Gap 2: PharmacyProfileForm drops suite on load
The `GoogleAddressAutocomplete` value prop does not pass `suite` when rendering, so even though it loads suite at line 128, the autocomplete component never receives it.

### Gap 3: assign-user-role edge function drops suite
The `getAddressFields` helper at line 670 only maps `address_street`, `address_city`, `address_state`, `address_zip` -- it does NOT include `address_suite`. So suite is silently dropped during signup for doctors, pharmacies, reps.

### Gap 4: send-order-to-pharmacy drops suite
The patient data query at line 222 does not select `address_suite`, so when orders are transmitted to pharmacy APIs (including VIOS), the suite/apt number is missing from the patient address.

### Gap 5: DeliveryAddressEditor currentAddress interface missing suite
The `currentAddress` prop type only has `street`, `city`, `state`, `zip` -- no `suite`. So callers cannot pass existing suite data to the editor.

## Solution

### File 1: `src/components/profile/PracticeProfileForm.tsx`
- Add `suite: z.string().optional()` to the `address`, `shipping_address`, and `billing_address` objects in `profileFormSchema`
- Add `suite: profile.address_suite || ""` when populating form values (line 100-105)
- Add `suite: profile.shipping_address_suite || ""` when populating shipping values (line 109-114)

### File 2: `src/components/profile/PharmacyProfileForm.tsx`
- Add `suite: field.value.suite || ""` to the `GoogleAddressAutocomplete` value prop (line 334-339)

### File 3: `supabase/functions/assign-user-role/index.ts`
- Add `address_suite: roleData.address_suite || null` to the structured format return in `getAddressFields` (line 674)

### File 4: `supabase/functions/send-order-to-pharmacy/index.ts`
- Add `address_suite` to the patient_accounts select query (line 224)
- Include suite in the address when building the pharmacy API payload

### File 5: `src/components/orders/DeliveryAddressEditor.tsx`
- Add `suite?: string` to the `currentAddress` interface
- Include `suite` in the initial `AddressValue` state

## Suite Remains Optional
- All Zod fields use `z.string().optional()`
- All database columns are nullable TEXT
- No validation checks require suite
- The "Save" button logic only checks street, city, state, zip

## No Other Errors Found
- Allergy system: no address involvement, working correctly
- Patient dialog: already handles `address_suite` correctly
- Checkout: already fetches `shipping_address_suite`
- GoogleAddressAutocomplete component: already captures and displays suite

