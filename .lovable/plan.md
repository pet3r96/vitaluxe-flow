

# Fix: Add Suite/Apt Number Support to Address Autocomplete

## Problem
The address autocomplete component does not support suite, apartment, or unit numbers. When a user selects an address that includes a suite number (or tries to add one manually), the suite information is silently dropped. This affects every place addresses are used: signup, delivery address editing, and order placement.

## Root Cause
Three gaps in `GoogleAddressAutocomplete`:
1. Google Places `subpremise` component type is not parsed
2. No separate input field for suite/apt/unit
3. Manual edits to the input after autocomplete selection do not update parent state

## Solution

### 1. Update `AddressValue` type to include `suite` field
**File**: `src/components/ui/google-address-autocomplete.tsx`

Add `suite?: string` to the `AddressValue` interface. This is the data model change that flows through to all consumers.

### 2. Parse `subpremise` from Google Places response
**File**: `src/components/ui/google-address-autocomplete.tsx`

In the `onPlaceChanged` handler, add extraction for `subpremise` component type (used by Google for suite/apt/unit numbers).

### 3. Add a dedicated Suite/Apt input field
**File**: `src/components/ui/google-address-autocomplete.tsx`

Add a second, smaller input below the main address field labeled "Suite / Apt / Unit (optional)". This field:
- Auto-populates when Google returns a `subpremise`
- Allows manual entry at any time
- Updates the parent `onChange` whenever edited
- Includes the suite in the `formatted` address string

### 4. Include suite in validation call
**File**: `supabase/functions/google-validate-address/index.ts`

Update the edge function to accept and preserve a `suite` field. The suite is appended to the street when sending to Google Address Validation API and preserved in the response regardless of validation outcome.

### 5. Include suite in `formatted` address reconstruction
Ensure the `formatted` address string includes the suite (e.g., "123 Main St Suite 200, City, ST 12345") in both client-side and server-side formatting.

---

## Technical Details

### AddressValue interface change
```typescript
export interface AddressValue {
  street?: string;
  suite?: string;    // NEW -- Suite, Apt, Unit number
  city?: string;
  state?: string;
  zip?: string;
  formatted?: string;
  status?: 'verified' | 'unverified' | 'manual';
  verified_at?: string;
  source?: string;
  deliverable?: boolean;
}
```

### Component UI addition
A small input field appears below the main address input after an address is selected or when the component loads with existing data. It uses the same styling as the main input but is narrower (max ~200px).

### Edge function change (`google-validate-address/index.ts`)
- Accept `suite` in the request body
- Include suite in `addressLines` sent to Google API
- Preserve suite in all response paths (valid, suggestions, invalid, manual override)

### Files modified
1. `src/components/ui/google-address-autocomplete.tsx` -- type + UI + parsing
2. `supabase/functions/google-validate-address/index.ts` -- accept and preserve suite

### Files NOT modified (no changes needed)
- `DeliveryAddressEditor.tsx` -- already passes `AddressValue` through; suite flows automatically
- `DoctorSignupFields.tsx` -- uses `AddressValue`; suite flows automatically
- `PharmacySignupFields.tsx` -- uses `AddressValue`; suite flows automatically
- All other address consumers -- the `suite` field is optional so backward compatible

