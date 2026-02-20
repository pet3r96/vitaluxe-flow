

# Fix: Patient Add Says "Already Exists" + Success But Not Showing

## Three Bugs Found

### Bug 1: "Patient already exists" for cross-practice patients
The database has a **global** unique index on `lower(email)`:
```
patient_accounts_email_lower_unique ON (lower(email)) WHERE email IS NOT NULL
```
This prevents the same email from existing in **any** two practices. Since a patient can belong to multiple clinics, this needs to be scoped per-practice.

**Fix**: Drop the global unique index and create a new one scoped to `(practice_id, lower(email))`.

### Bug 2: Patient added successfully but doesn't appear in the list
After creating a patient, `PatientDialog` invalidates the query key `["practice-patients"]`. But the `PatientsDataTable` component fetches patients using `usePatients()`, which uses the query key `["patients", effectiveRole, effectivePracticeId]`. These don't match, so the list never refreshes after adding.

**Fix**: Update `PatientDialog` to also invalidate `["patients"]` query keys so the data table refreshes.

### Bug 3: Search input lag (same issue fixed on Accounts page)
The search input on this Patients page has the same debounce bug -- typing feels frozen because the input value only updates after the 300ms debounce.

**Fix**: Split into `inputValue` (instant) and debounced `searchQuery` (for filtering), same pattern applied to the Accounts and Staff pages.

## Files Changed

| File | Change |
|------|--------|
| New database migration | Drop `patient_accounts_email_lower_unique`, create `patient_accounts_practice_email_unique` on `(practice_id, lower(email))` |
| `src/components/patients/PatientDialog.tsx` | Also invalidate `["patients"]` query key after create/update |
| `src/components/patients/PatientsDataTable.tsx` | Fix search input lag with `useDebounce` pattern |

