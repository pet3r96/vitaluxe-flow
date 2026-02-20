
# Fix: Email Verification Loop + Final Address Suite Audit

## Status: COMPLETED ✅

### Issue 1: Email Verification Resend - FIXED ✅

**Root Cause**: The "Resend Verification Email" button was sending only `{ email }` but the edge function required `{ userId, email, name }`, causing HTTP 400.

**Changes Made:**
1. `src/lib/authService.ts` — Added `userId: user.id` to the `email_not_verified` error return
2. `src/pages/Auth.tsx` — Added `reminderUserId` state, stores userId from login error, passes it in resend call
3. `supabase/functions/send-verification-email/index.ts` — Added fallback: if userId not provided, looks up user by email from profiles table. Uses `resolvedUserId` throughout.

### Issue 2: Address Suite/Apt Audit - CONFIRMED COMPLETE ✅

All modules properly handle suite/apt field end-to-end. No gaps remain.
