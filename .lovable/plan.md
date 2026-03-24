

# Plan: Resend Welcome Email + Verify Affiliate Practice Email Flow

## Part 1: Resend Welcome Email to john.simon.grant@gmail.com

The user exists in the system:
- **User ID**: `6f167081-c882-4864-9830-2b9ffffe32a0`
- **Email**: john.simon.grant@gmail.com
- **Name**: John Simon
- **Role**: topline

**Action**: Invoke the `send-welcome-email` edge function directly via `curl_edge_functions` with this user's data to resend their welcome email immediately.

## Part 2: Verify Affiliate → Practice Email Flow

After investigation, the affiliate practice creation flow already handles emails correctly:

1. **Affiliate submits request** → `AddPracticeRequestDialog` inserts into `pending_practices` table (no user created yet, no email needed)
2. **Admin approves** → `approve-pending-practice` edge function creates the user account AND sends a welcome email via `send-welcome-email` (lines 294-325)

This flow is working. However, the `approve-pending-practice` function uses raw `fetch()` instead of `supabaseAdmin.functions.invoke()` to call `send-welcome-email`. While functional, switching to `supabaseAdmin.functions.invoke()` would be more robust and consistent with the rest of the codebase.

## Changes

1. **Resend email** — Call `send-welcome-email` for john.simon.grant@gmail.com (no code change, just invocation)
2. **Improve `approve-pending-practice`** — Replace raw `fetch()` call (lines 296-315) with `supabaseAdmin.functions.invoke('send-welcome-email', ...)` for consistency and better error handling
3. **Redeploy** `approve-pending-practice` after the change

