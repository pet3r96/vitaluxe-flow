

# Fix: Self-Signup Blocked by Admin IP Filter

## Problem
The `assign-user-role` edge function applies an admin-only IP allowlist check to ALL requests. Self-signup requests from users' browsers are rejected with "Forbidden - IP address not authorized" because their IP is not in the admin allowlist. This breaks signup for every role.

The logs confirm it:
```
"Unauthorized IP attempting admin access" ip: "75.226.135.8"
"Admin function access denied - IP not in allowlist"
```

## Fix
In `supabase/functions/assign-user-role/index.ts` (lines 119-125), expand the IP check bypass to also skip for self-signup requests.

### Current code (line 119-125):
```typescript
const isPharmacyStaffCreation = (signupData.role as string) === 'pharmacy_staff';
if (!isPharmacyStaffCreation) {
  const ipCheckResponse = await enforceAdminIP(req, supabaseAdmin, 'assign-user-role');
  if (ipCheckResponse) return ipCheckResponse;
}
```

### Updated code:
```typescript
const isPharmacyStaffCreation = (signupData.role as string) === 'pharmacy_staff';
const isSelfSignup = signupData.isSelfSignup === true;
if (!isPharmacyStaffCreation && !isSelfSignup) {
  const ipCheckResponse = await enforceAdminIP(req, supabaseAdmin, 'assign-user-role');
  if (ipCheckResponse) return ipCheckResponse;
} else {
  edgeLogger.info('[assign-user-role] Skipping IP check', { 
    reason: isSelfSignup ? 'self-signup' : 'pharmacy_staff creation' 
  });
}
```

Self-signup requests already set `isSelfSignup: true` from the frontend (`authService.ts`), so this flag is already present. The IP check will still enforce for admin-created users, preserving security for admin operations.

### Security note
Self-signup is already protected by:
- Rate limiting (3 signups per hour per IP)
- CSRF validation / trusted origin checks
- Password strength validation
- Email verification (status set to `pending_verification`)

One file changed, one condition added. No database changes needed.
