

# Fix: Patient Apartment/Suite Number Not Persisting

## Root Cause

The suite/apartment value saves to the database correctly, but it **never loads back** when the patient is viewed again. Two data-fetching paths omit `address_suite`:

1. **`src/services/patients/patientService.ts` line 15** — the `columns` string lists every address field except `address_suite`. When admin fetches patients, suite is missing.
2. **`get_practice_patients` RPC function** — the SQL query selects `address_street`, `address_city`, `address_state`, `address_zip`, `address_formatted` but NOT `address_suite`. When practice users fetch patients, suite is missing.

Because the list data includes `birth_date`, `allergies`, and `notes`, the PatientDialog's fallback full-fetch (which does include `address_suite`) is never triggered. So the dialog always shows an empty suite field, and if the user saves again, it overwrites the stored value with null.

## Fixes (2 changes, zero risk)

### 1. Database migration — Update the `get_practice_patients` RPC
Add `pa.address_suite` to the SELECT list in the function, right after `pa.address_street`.

### 2. `src/services/patients/patientService.ts`
Add `address_suite` to the `columns` string on line 15, after `address_street`.

No other files need changes. The PatientDialog already reads, writes, and displays `address_suite` correctly — it just never received the data from upstream queries.

