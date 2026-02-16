

## Fix: Pharmacy Owner Blocked from Adding Staff by IP Filter

### Problem
The `assign-user-role` edge function has an IP allowlist check (line 94) that runs **before** the request body is even parsed. This means when a pharmacy owner tries to add a staff member from their browser, the request is rejected with "Admin function access denied - IP not in allowlist" because their IP isn't on the admin allowlist. The IP filter is designed for admin-only operations but currently blocks **all** callers, including pharmacy owners performing legitimate actions.

### Fix

**File: `supabase/functions/assign-user-role/index.ts`**

Restructure the function so the IP check happens **after** parsing the request body. If the role being created is `pharmacy_staff`, skip the admin IP check entirely (but still verify the caller is actually a pharmacy owner for that pharmacy). For all other roles, keep the existing admin IP check.

The logic change:

1. Move request body parsing (lines 124-140) to happen **before** the IP check
2. After parsing, check: if `role === 'pharmacy_staff'`, skip `enforceAdminIP` -- the caller just needs to be an authenticated pharmacy owner (already verified later in the function)
3. For all other roles, keep the existing `enforceAdminIP` call

### Technical Details

```
Current flow:
  Request -> IP Check (BLOCKS pharmacy owners) -> Parse body -> Process

Fixed flow:
  Request -> Parse body -> If pharmacy_staff: skip IP check -> Process
                        -> If other role: IP Check -> Process
```

This is a minimal, targeted change. The pharmacy owner's authorization (verifying they own the pharmacy they're adding staff to) is already handled downstream in the function. We're only removing the blanket IP gate for this specific use case.
