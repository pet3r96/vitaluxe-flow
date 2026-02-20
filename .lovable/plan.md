

# Fix: Add Provider Dialog Request Body Mismatch

## Root Cause
The "Add Provider" dialog sends a request body that doesn't match what the `assign-user-role` edge function expects. Specifically:

1. **Missing `name`** (top-level) -- The edge function validates `signupData.name` as required, but the dialog never sends it. This causes the "name is required" validation error.
2. **Missing `prescriberName`** (top-level) -- The edge function reads `signupData.prescriberName` for the RPC call, but the dialog puts it inside `roleData.prescriber_name`.
3. **`practiceId` wrong location** -- The dialog sends `practiceId` at the top level, but the edge function reads it from `signupData.roleData.practiceId`.

## Fix (1 file)

### `src/components/providers/AddProviderDialog.tsx` (lines 170-182)

Update the request body to match the edge function's expected structure:

```typescript
const requestBody = {
  email: formData.email.trim(),
  role: "provider",
  name: formData.fullName.trim(),              // ADD: top-level name (required by validation)
  fullName: formData.fullName.trim(),           // ADD: top-level fullName (used by RPC)
  prescriberName: formData.prescriberName.trim(), // ADD: top-level prescriberName (used by RPC)
  roleData: {
    practiceId: targetPracticeId,               // MOVE: was at top level, edge function reads from roleData
    prescriber_name: formData.prescriberName.trim(),
    npi: formData.npi.trim(),
    dea: formData.dea.trim(),
    license_number: formData.licenseNumber.trim(),
    phone: formData.phone.replace(/\D/g, ''),
    full_name: formData.fullName.trim(),
  }
};
```

## What changes
- `name`, `fullName`, and `prescriberName` added as top-level fields
- `practiceId` moved from top level into `roleData`
- Everything inside `roleData` stays the same

## What stays the same
- All form validation logic (NPI verification, phone, DEA)
- Edge function code -- no changes needed
- CSRF token handling
- Query invalidation after success

