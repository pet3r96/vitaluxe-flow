

# Fix: Grant Portal Access - CSRF Token Missing + User Lookup Scalability

## Issues Found

### Issue 1: CSRF Token Not Sent (Critical - Blocks Functionality)
The `create-patient-portal-account` edge function requires a CSRF token (validated on line 98-106), but the client-side call in `PatientsDataTable.tsx` (line 121-124) does **not** include the `x-csrf-token` header. This causes a **403 Forbidden** error every time a practice tries to grant portal access.

Other edge function calls in the codebase (checkout, impersonation, cancel order) correctly include the CSRF token -- this one was missed.

### Issue 2: `listUsers()` Without Pagination (Low Risk Now, Will Break Later)
The edge function calls `supabaseAdmin.auth.admin.listUsers()` on line 493 without specifying `perPage`. The default page size is typically 50-100. With 26 users currently, this works fine, but as the platform grows it will fail to find existing users, causing duplicate auth user errors or unnecessary password resets.

## Fix

### File: `src/components/patients/PatientsDataTable.tsx`
Add the CSRF token header to the `create-patient-portal-account` invocation:

```typescript
import { getCSRFToken } from "@/lib/csrf";

// In the mutation:
const csrfToken = getCSRFToken();
if (!csrfToken) {
  throw new Error("Security token missing. Please refresh the page.");
}

const { data: portalData, error: portalError } = await supabase.functions.invoke(
  'create-patient-portal-account',
  { 
    body: { patientId },
    headers: { 'x-csrf-token': csrfToken }
  }
);
```

### File: `supabase/functions/create-patient-portal-account/index.ts`
Replace the unscalable `listUsers()` call with a targeted email lookup:

```typescript
// Instead of listing ALL users and filtering client-side:
const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers();
const foundUser = existingAuthUser?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);

// Use a paginated lookup or direct query approach:
const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
  page: 1,
  perPage: 1000
});
const foundUser = users?.find(u => u.email?.toLowerCase() === normalizedEmail);
```

This ensures the lookup covers all users. At larger scale (1000+ users), this should be migrated to a direct auth schema query, but for now 1000 perPage is sufficient.

## Summary

| File | Change |
|------|--------|
| `src/components/patients/PatientsDataTable.tsx` | Add CSRF token header to edge function call |
| `supabase/functions/create-patient-portal-account/index.ts` | Add `perPage: 1000` to `listUsers()` call |

