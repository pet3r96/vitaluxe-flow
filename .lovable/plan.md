

# Audit: Email Delivery for All User Creation Paths

## Current State

The code fix from the previous session (replacing `email-dispatcher` with `send-verification-email` / `send-welcome-email`) is correctly in the source code. However, **there are no recent edge function logs for `assign-user-role`**, which suggests the function may not have been successfully redeployed, or no new users have been created since the fix.

## Email Path Coverage

| Creation Path | Email Function | Source | Status |
|---|---|---|---|
| Self-signup | `send-verification-email` | `assign-user-role` (line 941) | ✅ Correct |
| Admin-created doctor/practice/pharmacy/topline/downline/provider | `send-welcome-email` | `assign-user-role` (line 982) | ✅ Correct |
| Admin-created staff | `send-welcome-email` | Frontend (`AddStaffDialog`, line 148) | ✅ Correct (intentionally skipped in assign-user-role to avoid duplicates) |
| Admin-created pharmacy staff | `send-welcome-email` | Frontend (`AddPharmacyStaffDialog`, line 117) | ✅ Correct |
| Resend welcome (all roles) | `send-welcome-email` | Various UI components (AccountDetails, StaffDetails, PharmacyStaffTable, PracticePatients, PatientsDataTable) | ✅ Correct |
| Resend verification | `send-verification-email` | Auth page (line 353) | ✅ Correct |
| Admin-created admin | None | Neither backend nor frontend sends | ⚠️ Gap (rare edge case) |

## Action Required

**1. Redeploy `assign-user-role`** — The function must be redeployed to ensure the email fix (from the previous session) is live. Without redeployment, the old code calling `email-dispatcher` is still running in production.

**2. (Optional) Include admin role in welcome emails** — Line 957 excludes `admin` and `staff` roles. Staff is handled by the frontend, but admin-created admin users get no email. This is a rare edge case but should be fixed for completeness by removing `&& signupData.role !== 'admin'` from the condition.

## Files to Change

- **`supabase/functions/assign-user-role/index.ts`** (line 957): Change condition from:
  ```typescript
  } else if (isAdminCreated && signupData.role !== 'admin' && signupData.role !== 'staff') {
  ```
  to:
  ```typescript
  } else if (isAdminCreated && signupData.role !== 'staff') {
  ```

- **Redeploy**: `assign-user-role`, `send-welcome-email`, `send-verification-email`, and `unified-email-sender` edge functions to ensure all are running latest code.

