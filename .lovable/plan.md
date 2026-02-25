

# Fix: Surface Real Error Messages from Backend Functions

## The Problem

When adding a provider (or any user) with an email that already exists, the system shows a generic error: **"Edge Function returned a non-2xx status code"** instead of the actual helpful message: **"A user with this email address has already been registered."**

This affects 6 dialogs across the app that all use the same broken pattern.

## Root Cause

All 6 dialogs use `getEdgeFunctionError(data, error)` -- the **synchronous** version -- which cannot read the response body because parsing the response requires an **async** call (`context.json()`). The async version `getEdgeFunctionErrorAsync` already exists but is not being used.

## Affected Files

1. `src/components/providers/AddProviderDialog.tsx` (line 195) -- the one you just hit
2. `src/components/staff/AddStaffDialog.tsx` (line 141)
3. `src/components/pharmacies/PharmacyDialog.tsx` (line 192)
4. `src/components/pharmacies/AddPharmacyStaffDialog.tsx` (line 110)
5. `src/components/practices/AddPracticeDialog.tsx` (line 226)
6. `src/components/accounts/AddAccountDialog.tsx` (line 258)

## The Fix

In each file, change:
```typescript
import { getEdgeFunctionError } from "@/types/edgeFunction";
// ...
if (error) throw new Error(getEdgeFunctionError(data, error));
```

To:
```typescript
import { getEdgeFunctionErrorAsync } from "@/types/edgeFunction";
// ...
if (error) {
  const errorMsg = await getEdgeFunctionErrorAsync(data, error);
  throw new Error(errorMsg);
}
```

All 6 call sites are already inside `async` functions, so adding `await` is safe with no other changes needed.

## Result

After this fix, users will see clear, actionable error messages like:
- "A user with this email address has already been registered"
- "Invalid NPI format"
- Any other specific error the backend returns

Instead of the unhelpful generic "Edge Function returned a non-2xx status code."

