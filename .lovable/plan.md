

# Fix: Instant Patient Visibility Across All Flows

## Problem

Even though the PatientDialog now clears caches after adding a patient, two issues remain:

1. The global React Query config sets `refetchOnMount: false`, which means if you navigate to Products and open "Add to Cart" within 30 seconds of a previous fetch, the dialog shows stale cached data instead of refetching.
2. The PatientSelectionDialog (the "select a patient" dialog on the Products page) does not force a refetch when it opens, so it can serve stale data from a prior session.

## Changes

### 1. PatientSelectionDialog: Always refetch when dialog opens

**File: `src/components/products/PatientSelectionDialog.tsx`**

Add `refetchOnMount: "always"` and `staleTime: 0` to the patient query so that every time the dialog opens, it fetches the latest patients from the database -- no stale cache.

### 2. Global config: Enable refetchOnMount

**File: `src/lib/queryClient.ts`**

Change `refetchOnMount: false` to `refetchOnMount: true`. The current `false` setting is too aggressive and causes stale data bugs across the app. With `staleTime: 30s` still in place, this only triggers refetches when data is stale (older than 30s), so there's minimal performance impact.

### 3. PatientDialog: Also clear query for the specific practice ID

**File: `src/components/patients/PatientDialog.tsx`**

The current `removeQueries({ queryKey: ["practice-patients"] })` already handles prefix matching, but we should also explicitly remove the patients query used by the main patients page (`["patients", effectiveRole, effectivePracticeId]`) to cover that flow too.

## Technical Summary

| File | Change |
|------|--------|
| `src/components/products/PatientSelectionDialog.tsx` | Add `refetchOnMount: "always"` and `staleTime: 0` to patient query |
| `src/lib/queryClient.ts` | Change `refetchOnMount: false` to `refetchOnMount: true` |
| `src/components/patients/PatientDialog.tsx` | Ensure all patient query keys are cleared on add |

## Expected Result

- Add a patient on the Patients page -- it appears instantly in the list
- Navigate to Products, open "Add to Cart" -- the new patient is there immediately
- Go to Cart and create an order -- the patient is available for selection
- No stale data anywhere in the app

