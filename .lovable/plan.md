

# Fix & Regenerate Prescription PDF for Renee Rodriguez

## Problem

The `order_line_id` mode in `generate-prescription-pdf` doesn't fetch patient address, DOB, or sex from `patient_accounts`. It only uses `orderLine.patient_address` (which is null for this order) and `orderLine.patient_name`. So even though `is_office_dispensing` will now correctly be `false`, the PDF will show "N/A" for address, DOB, age, and sex.

## Data Available in `patient_accounts`

| Field | Value |
|-------|-------|
| `address_street` | 8750 East McDowell Road |
| `address_suite` | 113 |
| `address_city` | Scottsdale |
| `address_state` | AZ |
| `address_zip` | 85257 |
| `birth_date` | 1977-05-15 |
| `gender_at_birth` | f |

## Fix: `supabase/functions/generate-prescription-pdf/index.ts`

In the `order_line_id` branch (around line 186), after fetching the provider profile, add a lookup to `patient_accounts` to get the patient's address, DOB, and sex:

```typescript
// Fetch patient details from patient_accounts
const { data: patientAccount } = await supabase
  .from('patient_accounts')
  .select('address_street, address_suite, address_city, address_state, address_zip, birth_date, date_of_birth, gender_at_birth')
  .eq('id', orderLine.patient_id)
  .single();
```

Then include these in the `prescriptionData` object:
- `patient_dob`: Format `birth_date || date_of_birth` as MM/DD/YYYY
- `patient_address_street`: `address_street` + suite if present
- `patient_address_city`: from patient_accounts
- `patient_address_state`: from patient_accounts  
- `patient_address_zip`: from patient_accounts
- `patient_address`: formatted full address as fallback
- `patient_sex`: from `gender_at_birth`
- `patient_age`: calculated from DOB

This ensures the PDF renders with full patient info when using the `order_line_id` regeneration path.

## Regeneration

After deploying the fix, call the edge function with `{ "order_line_id": "95d9e316-3cf2-4a6c-8cd9-f54b348b80dd" }` to regenerate the PDF. The function already handles uploading and returning the new URL. Then update the `prescription_url` on the order line.

## Files Changed
- `supabase/functions/generate-prescription-pdf/index.ts` (add patient_accounts lookup in order_line_id mode)

