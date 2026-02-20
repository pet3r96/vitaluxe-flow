
# Fix: Email Verification Loop + Final Address Suite Audit

## Issue 1: Email Verification Error (CRITICAL)

### What the user is seeing
The client (`info@bodypreserve.com`) logs in, gets told "Please Verify Your Email", clicks "Resend Verification Email", and gets a red toast: **"Edge Function returned a non-2xx status code"**.

### Root Cause
Two bugs working together:

**Bug A: Resend button sends incomplete data**
In `src/pages/Auth.tsx` (line 351-354), the "Resend Verification Email" button calls `send-verification-email` with only `{ email: reminderEmail }`. But the edge function requires `{ userId, email, name }`. Since `userId` is missing, the function returns HTTP 400 ("Missing userId or email").

**Bug B: The login flow doesn't pass `userId` to the verification reminder screen**
When `authService.loginUser()` detects `status === 'pending_verification'`, it returns `{ code: 'email_not_verified', email }` but does NOT return the `user.id`. The Auth.tsx code only stores `reminderEmail` -- never the userId. So the resend button has no userId to send.

### Fix

**File: `src/lib/authService.ts`** (line 226-235)
- Include `userId: user.id` in the `email_not_verified` error return, so the frontend has the user ID available.

**File: `src/pages/Auth.tsx`**
- Store the `userId` from the error response in state alongside `reminderEmail`.
- Pass `userId`, `email`, and `name` (from the login form) when calling `send-verification-email`.

**File: `supabase/functions/send-verification-email/index.ts`**
- Add a fallback: if `userId` is not provided but `email` is, look up the user ID from the `profiles` table by email. This makes the resend robust even if the frontend doesn't have the userId.

### Why this user is stuck in verification
The database confirms `info@bodypreserve.com` has `status: pending_verification` and `verified_at: null`. This means either:
1. They never clicked the verification link in their original signup email, OR
2. The verification link in the email points to `https://app.vitaluxeservices.com/verify-email` which may be the correct custom domain, but if that domain isn't set up to serve this app, the link would go nowhere.

The fix ensures the resend button actually works so the user can get a new verification email.

---

## Issue 2: Address Suite/Apt Audit (CONFIRMED COMPLETE)

After reviewing every address touchpoint in the system, the suite/apt field is now properly configured everywhere:

| Module | Status | Details |
|--------|--------|---------|
| Database columns | Done | `address_suite` on profiles, patient_accounts, pharmacies; `shipping_address_suite` on profiles |
| Supabase types | Done | All three tables have `address_suite` in generated types |
| PracticeProfileForm | Done | Zod schema includes `suite`, form loads `address_suite` and `shipping_address_suite` |
| PharmacyProfileForm | Done | Saves and loads `address_suite`, passes `suite` to autocomplete |
| PatientDialog | Done | Saves and loads `address_suite`, passes `suite` to autocomplete |
| Auth signup | Done | Passes `address_suite` for doctor and pharmacy roles |
| DeliveryAddressEditor | Done | Interface includes `suite`, state initialized with suite |
| Checkout | Done | Fetches `shipping_address_suite` |
| assign-user-role edge function | Done | `getAddressFields` includes `address_suite` |
| send-order-to-pharmacy | Done | Patient query selects `address_suite` |
| VIOS order payload | Done | Maps `address_suite` to `address2` field |
| GoogleAddressAutocomplete | Done | Parses `subpremise`, has dedicated suite input field |
| google-validate-address | Done | Accepts and preserves suite in all response paths |
| Suite field optional | Done | All Zod fields `z.string().optional()`, all DB columns nullable |

No remaining gaps found.

---

## Technical Implementation Details

### File 1: `src/lib/authService.ts`
- At line 228-234, add `userId: user.id` to the error return object so the Auth page can use it for resending.

### File 2: `src/pages/Auth.tsx`
- Add `reminderUserId` state variable.
- When login returns `email_not_verified`, store both `error.email` and `error.userId`.
- Update the resend button (line 351-354) to pass `{ userId: reminderUserId, email: reminderEmail, name: '' }`.

### File 3: `supabase/functions/send-verification-email/index.ts`
- Add fallback logic: if `userId` is not provided, look it up from `profiles` table by email.
- This prevents the 400 error even if the frontend doesn't pass userId.

### Files NOT changing
- `verify-email/index.ts` -- working correctly, sets `status: 'active'` and `verified_at`
- All address-related files -- audit confirms everything is properly wired
- `config.toml` -- `verify_jwt = false` is correctly set for both email functions
