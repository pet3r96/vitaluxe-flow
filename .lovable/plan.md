

# Fix: "Missing provider credentials" Error When Adding Provider

## Problem

When a practice adds a provider **without** a DEA number, the backend rejects the request with "Missing provider credentials". This happens because:

- The **Add Provider form** treats DEA as optional (no asterisk, not required)
- The **edge function** (line 370) treats DEA as mandatory: `if (!signupData.roleData.npi || !signupData.roleData.dea)`
- An empty string `""` is falsy in JavaScript, so `!""` evaluates to `true`, triggering the error

DEA numbers are genuinely optional for many provider types (e.g., nurse practitioners in some states, providers who don't prescribe controlled substances).

## Fix

### File: `supabase/functions/assign-user-role/index.ts` (line 370)

Change the provider credential validation to only require NPI (which is always mandatory), and make DEA optional:

```typescript
// Before (line 370):
if (!signupData.roleData.npi || !signupData.roleData.dea) {

// After:
if (!signupData.roleData.npi) {
```

Update the error message on line 375 accordingly:

```typescript
// Before:
return errorResponse('Providers must have NPI and DEA numbers', 400);

// After:
return errorResponse('Providers must have a valid NPI number', 400);
```

No other files need changes. The form already correctly treats DEA as optional.

## Why the audit didn't catch this

The audit tested the **existing user flows** (patient addition, calendar, vault, intake). The provider-addition flow wasn't triggered during testing -- the "Missing provider credentials" errors appeared at 17:46 and 17:47 (after the audit), when a real user tried adding a provider without a DEA.

