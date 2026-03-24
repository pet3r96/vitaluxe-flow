

# VitaLuxe Production Audit Report: Signup, Authentication, and Access Ecosystem

---

## A. Executive Summary

The VitaLuxe authentication and onboarding system is **functionally sound for production** with a well-designed architecture. The recent email fixes (`assign-user-role` calling correct email functions) resolved the most critical delivery issue. However, this audit identified **4 critical issues, 6 high-severity issues, and 12 medium issues** that should be addressed.

**Confidence level**: 85% stable. The core happy paths work correctly. The risks are concentrated in edge cases (pagination limits, non-atomic multi-step creation, inconsistent email invocation patterns) and could cause intermittent failures at scale.

**Overall status**: Production-viable with targeted fixes needed. No user-facing showstoppers in standard flows.

---

## B. Architecture Inventory

### User Roles (8 total)
`admin`, `doctor` (practice), `pharmacy`, `topline`, `downline`, `provider`, `staff`, `patient`

### Account Creation Entry Points (7 paths)

| # | Path | Trigger | Backend | Email Function |
|---|------|---------|---------|----------------|
| 1 | Self-signup (doctor/pharmacy/topline) | `Auth.tsx` form | `assign-user-role` | `send-verification-email` |
| 2 | Admin-created user (any non-staff role) | Admin UI dialogs | `assign-user-role` | `send-welcome-email` |
| 3 | Admin-created staff | `AddStaffDialog.tsx` | `assign-user-role` → frontend calls `send-welcome-email` | `send-welcome-email` (frontend) |
| 4 | Admin-created pharmacy staff | `AddPharmacyStaffDialog.tsx` | `assign-user-role` → frontend calls `send-welcome-email` | `send-welcome-email` (frontend) |
| 5 | Affiliate adds practice (pending → approve) | `AddPracticeRequestDialog` → admin approves | `approve-pending-practice` | `send-welcome-email` |
| 6 | Rep approval (pending → approve) | Admin approves pending rep | `approve-pending-rep` | `send-welcome-email` (via raw `fetch`) |
| 7 | Patient portal account | Practice/provider creates | `create-patient-portal-account` → frontend calls `send-welcome-email` | `send-welcome-email` (frontend) |

### Key Frontend Pages
- `Auth.tsx` - Login + Signup
- `VerifyEmail.tsx` - Email verification landing
- `ChangePassword.tsx` - Token-based + authenticated password change
- `AcceptTerms.tsx` - Terms acceptance gate
- `Dashboard.tsx` - Role-based dashboard

### Key Edge Functions (auth-related)
- `assign-user-role` - Primary user creation
- `verify-email` - Email verification token processing
- `send-welcome-email` - Welcome email with password setup link
- `send-verification-email` - Verification email
- `send-password-reset-email` - Forgot password flow
- `reset-password-with-token` - Token-based password change
- `validate-password-token` - Token validation
- `approve-pending-practice` - Practice approval flow
- `approve-pending-rep` - Rep approval flow
- `create-patient-portal-account` - Patient portal creation
- `unified-email-sender` - Postmark integration layer
- `send-2fa-sms` / `verify-2fa-sms` - 2FA flows
- `track-failed-login` / `detect-brute-force` - Security monitoring

### Key DB Tables
- `profiles` - User profiles (all roles)
- `user_roles` - Role assignments
- `user_password_status` - Password change tracking
- `user_terms_acceptances` - Terms acceptance
- `email_verification_tokens` - Verification tokens
- `temp_password_tokens` - Welcome/activation tokens
- `password_reset_tokens` - Forgot password tokens
- `patient_accounts` - Patient records
- `providers` - Provider records
- `practice_staff` - Staff membership
- `pharmacy_staff` - Pharmacy staff membership
- `reps` - Rep records
- `pending_practices` / `pending_reps` - Approval queues
- `user_2fa_settings_decrypted` - 2FA enrollment
- `practice_subscriptions` - Subscription status
- `audit_logs` - Audit trail

---

## C. Flow-by-Flow Audit

### Flow 1: Self-Signup (Doctor/Pharmacy/Topline)

**Entry**: `Auth.tsx` signup form → `authService.signupUser()` → `assign-user-role` edge function

**Steps**:
1. Frontend validates fields (NPI verified against NPPES, password strength checked)
2. `authService.signupUser` checks for duplicate email via `profiles` table
3. Calls `assign-user-role` with `isSelfSignup: true`
4. Edge function: rate limits, validates CSRF, validates fields, verifies NPI against NPPES
5. Creates auth user with `email_confirm: false`
6. Calls `create_user_with_role` RPC (atomic: creates profile, user_role, role-specific records)
7. Updates profile with additional fields
8. Calls `send-verification-email` → generates token → calls `unified-email-sender` (Postmark)
9. Frontend shows verification message

**Verification**: User clicks link → `VerifyEmail.tsx` → `verify-email` edge function → marks profile `active`, sets `email_confirm: true` in auth, marks token used

**Status**: **WORKING CORRECTLY**

**Risks identified**:
- **CRITICAL (C1)**: `assign-user-role` line 425 uses `listUsers()` without pagination - returns max 1000 users. At scale, duplicate email check will miss users beyond page 1, allowing duplicate auth accounts.
- **MEDIUM (M1)**: Double duplicate check - both `authService.signupUser` (frontend, checks `profiles`) and `assign-user-role` (backend, checks `auth.users` via `listUsers`) check for duplicates. The frontend check is redundant but harmless.

### Flow 2: Admin-Created User (non-staff)

**Entry**: Various admin dialogs → `authService.createUserByAdmin()` → `assign-user-role` with `isAdminCreated: true`

**Steps**:
1. `assign-user-role` generates password, creates auth user with `email_confirm: true`
2. Calls `create_user_with_role` RPC
3. Creates `user_password_status` record with `must_change_password: true`
4. Calls `send-welcome-email` → generates `temp_password_tokens` entry → sends email with password setup link

**Login flow**: User clicks "Set Your Password" link → `ChangePassword.tsx` (token mode) → `validate-password-token` → `reset-password-with-token` → clears `must_change_password`, clears `temp_password`, auto-login

**Status**: **WORKING CORRECTLY**

**Risks identified**:
- **HIGH (H1)**: `send-welcome-email` also generates a `temp_password_tokens` entry (line 62-68). But `assign-user-role` already generates one for staff (line 870). For non-staff admin-created users, `assign-user-role` does NOT generate a token — only `send-welcome-email` does. This is correct but could be confusing.

### Flow 3: Staff Creation

**Entry**: `AddStaffDialog.tsx` → `assign-user-role` with role `staff` → frontend calls `send-welcome-email`

**Steps**:
1. `assign-user-role` creates user, creates `practice_staff` record, generates activation token
2. Returns `token` and `userId` to frontend
3. Frontend calls `send-welcome-email` directly (line 148)

**Status**: **WORKING CORRECTLY** - Staff email is intentionally sent from frontend to avoid duplicates (assign-user-role skips email for staff role at line 957)

**Risks identified**:
- **HIGH (H2)**: If the frontend `send-welcome-email` call fails (network issue, edge function error), the user is created but never receives their welcome email. No retry mechanism exists. The admin sees a toast error but the user is stuck without access instructions.

### Flow 4: Pharmacy Staff Creation

**Entry**: `AddPharmacyStaffDialog.tsx` → `assign-user-role` → frontend calls `send-welcome-email`

**Status**: **WORKING CORRECTLY** - Same pattern as staff, same risk (H2).

### Flow 5: Affiliate Practice Approval

**Entry**: Rep submits practice request → `pending_practices` table → Admin approves → `approve-pending-practice`

**Steps**:
1. Creates auth user (or finds existing), upserts profile, role, password status
2. Calls `send-welcome-email` via `supabaseAdmin.functions.invoke()` (recently fixed)

**Status**: **WORKING CORRECTLY** after recent fix

### Flow 6: Rep Approval

**Entry**: Pending rep request → Admin approves → `approve-pending-rep`

**Status**: **PARTIALLY WORKING - ISSUE FOUND**

**Risks identified**:
- **HIGH (H3)**: `approve-pending-rep` (lines 356-375) still uses raw `fetch()` to call `send-welcome-email` instead of `supabaseAdmin.functions.invoke()`. This uses the anon key, which means the call goes through normal auth and is less reliable than the service-role invoke pattern. This is the SAME bug pattern that was fixed in `approve-pending-practice` but was NOT fixed here.

### Flow 7: Patient Portal Account

**Entry**: Practice/provider UI → `create-patient-portal-account` → frontend calls `send-welcome-email`

**Steps**:
1. Edge function creates auth user, links patient_accounts, creates role, generates token
2. Returns token to frontend
3. Frontend calls `send-welcome-email`

**Status**: **WORKING CORRECTLY**

**Risks identified**:
- **CRITICAL (C2)**: `create-patient-portal-account` uses `listUsers({ page: 1, perPage: 1000 })` (line 493) for email lookup. At scale (>1000 auth users), existing patients may not be found, causing duplicate auth user creation attempts.
- **HIGH (H4)**: Patient portal creation is NOT atomic. Auth user is created first, then patient_accounts is updated, then role is assigned. If patient_accounts update fails, rollback deletes the auth user (line 588-589), but if the role insert fails, it's silently ignored (line 612-613 "Don't fail - trigger will handle this"). If there's no trigger, the patient has no role.

---

## D. Problems Found

### CRITICAL

| ID | Problem | Location | Impact | Frequency |
|----|---------|----------|--------|-----------|
| C1 | `listUsers()` without pagination in `assign-user-role` | `assign-user-role/index.ts:425` | Duplicate auth users can be created once >1000 users exist | Increases with scale |
| C2 | `listUsers()` with `perPage: 1000` limit in patient portal | `create-patient-portal-account/index.ts:493` | Same as C1 - duplicate patients at scale | Increases with scale |
| C3 | `detect-brute-force` also uses unpaginated `listUsers()` | `detect-brute-force/index.ts:85` | Account lockout may fail to find user at scale | Increases with scale |

### HIGH

| ID | Problem | Location | Impact | Frequency |
|----|---------|----------|--------|-----------|
| H1 | `approve-pending-rep` still uses raw `fetch()` for welcome email | `approve-pending-rep/index.ts:356-375` | Email may fail silently due to anon key auth issues | Every rep approval |
| H2 | Staff/pharmacy staff welcome email sent from frontend with no retry | `AddStaffDialog.tsx:148`, `AddPharmacyStaffDialog.tsx:117` | User created without access instructions if email call fails | Intermittent |
| H3 | `create-patient-portal-account` returns `temporaryPassword` in response body | `create-patient-portal-account/index.ts:663` | Password visible in network tab/logs; not used since token flow handles it | Every patient creation |
| H4 | Patient role assignment failure silently ignored | `create-patient-portal-account/index.ts:612` | Patient could exist in auth without role, breaking authorization | Rare |
| H5 | `approve-pending-rep` returns `temporaryPassword` in response body | `approve-pending-rep/index.ts:411` | Same as H3 - password in response | Every rep approval |
| H6 | `assign-user-role` practice_staff record failure is non-fatal | `assign-user-role/index.ts:854-856` | Staff user created but practice membership missing - user has role but no practice access | Rare |

### MEDIUM

| ID | Problem | Location | Impact |
|----|---------|----------|--------|
| M1 | Redundant duplicate email check in frontend `authService` | `authService.ts:52-58` | Unnecessary DB query; harmless |
| M2 | 2FA error defaults to forcing setup | `AuthContext.tsx:193-196` | On transient error, user forced to re-setup 2FA |
| M3 | Bootstrap timeout cache fallback sets `twoFAStatusChecked: true` without checking | `AuthContext.tsx:230` | 2FA could be bypassed during slow bootstraps |
| M4 | `send-welcome-email` checks `system_settings.key='two_factor_auth_enabled'` but 2FA uses `system_settings.setting_key='two_fa_enforcement_enabled'` | `send-welcome-email/index.ts:94-98` vs `AuthContext.tsx:122-125` | 2FA mention in welcome email may not match actual enforcement setting |
| M5 | `send-password-reset-email` rate limiting does an inline profile lookup in the count query | `send-password-reset-email/index.ts:33-37` | Complex query; could fail if profile doesn't exist |
| M6 | Verification email link hardcoded to `app.vitaluxeservices.com` | `send-verification-email/index.ts:84` | Won't work in staging/preview environments |
| M7 | Welcome email link hardcoded to `app.vitaluxeservices.com` | `send-welcome-email/index.ts:103` | Same as M6 |
| M8 | Password reset link hardcoded to `app.vitaluxeservices.com` | `send-password-reset-email/index.ts:74` | Same as M6 |
| M9 | `ChangePassword.tsx` auto-login bypasses `authService.loginUser` checks | `ChangePassword.tsx:151-153` | Bypasses account status check, temp_password check, patient disabled check after password reset |
| M10 | Session activity listeners attached inside `useEffect` with `[]` deps but check `user?.id` | `AuthContext.tsx:321` | Listeners attached once; if user changes, old handler has stale closure |
| M11 | Failsafe interval on session restore uses 30s (line 567) but SIGNED_IN uses 10s (line 410) | `AuthContext.tsx:567 vs 410` | Inconsistent timeout detection on page reload vs fresh login |
| M12 | `approve-pending-rep` creates profile directly (not via RPC) | `approve-pending-rep/index.ts:218-233` | Different code path than `assign-user-role` - could diverge in required fields |

---

## E. Duplicates / Legacy / Cleanup Risks

### Duplicate Logic
1. **Email duplicate check**: `authService` checks `profiles` table, `assign-user-role` checks `auth.users` via `listUsers()`. Both exist for defense-in-depth but could diverge.
2. **Token generation**: `send-welcome-email` generates its own `temp_password_tokens` entry. `assign-user-role` also generates one for staff. For non-staff admin-created users, only `send-welcome-email` creates the token - this is correct but subtle.

### Inconsistent Patterns
1. **Email invocation**: `approve-pending-practice` uses `supabaseAdmin.functions.invoke()`. `approve-pending-rep` uses raw `fetch()` with anon key. `assign-user-role` uses `supabaseAdmin.functions.invoke()`. Staff/pharmacy staff use frontend `supabase.functions.invoke()`. Should be standardized.
2. **User creation**: `assign-user-role` uses atomic `create_user_with_role` RPC. `approve-pending-practice` and `approve-pending-rep` do manual sequential inserts (profile → role → rep record). Different code paths for the same outcome.

### Dead Code
- `sessionValidator.ts` - Explicitly marked as DEPRECATED, not imported anywhere. Safe to delete.
- `src/lib/email/emailClient.ts` - Frontend email client that calls `unified-email-sender`. Used by some components but overlaps with direct `supabase.functions.invoke('send-welcome-email')` calls. Not a conflict but could be consolidated.

---

## F. Missing Safeguards

1. **Missing pagination in `listUsers()`** (C1, C2, C3) - All three edge functions will fail to find users beyond page 1
2. **Missing idempotency** in `approve-pending-practice` and `approve-pending-rep` - Re-approving could create duplicate role/profile records (mitigated by `upsert` in practice, but not fully in rep)
3. **Missing transaction** in `create-patient-portal-account` - Multi-step creation with partial rollback
4. **Missing retry for frontend email calls** (H2) - Staff/pharmacy staff welcome emails have no retry if the call fails
5. **Missing environment-aware URLs** (M6-M8) - All email links hardcoded to production domain
6. **Missing status check bypass in auto-login** (M9) - `ChangePassword.tsx` auto-login doesn't check account status

---

## G. Concrete Fix Plan

### Phase 1: Critical Production Fixes (Immediate)

1. **Fix `listUsers()` pagination** in `assign-user-role`, `create-patient-portal-account`, and `detect-brute-force` - Replace with email-based lookup using `supabaseAdmin.auth.admin.getUserByEmail()` or query `profiles` table instead.
2. **Fix `approve-pending-rep` email invocation** - Replace raw `fetch()` with `supabaseAdmin.functions.invoke('send-welcome-email', ...)` (same fix already applied to `approve-pending-practice`).
3. **Remove `temporaryPassword` from response bodies** in `create-patient-portal-account` and `approve-pending-rep` - The token-based flow makes this unnecessary and it's a security risk.

### Phase 2: Consistency/Stability Fixes

4. **Add retry logic for frontend welcome email calls** - Wrap `send-welcome-email` calls in `AddStaffDialog`, `AddPharmacyStaffDialog` with a retry or add a "Resend Welcome Email" button immediately visible (already exists in detail dialogs).
5. **Fix `ChangePassword.tsx` auto-login** - Use `authService.loginUser()` instead of `supabase.auth.signInWithPassword()` to ensure account status checks run.
6. **Fix 2FA system settings key mismatch** in `send-welcome-email` - Use `setting_key: 'two_fa_enforcement_enabled'` instead of `key: 'two_factor_auth_enabled'`.
7. **Make `practice_staff` creation failure in `assign-user-role` fatal** - If staff membership fails, the user is broken. Should rollback.

### Phase 3: Cleanup/Hardening

8. **Standardize user creation paths** - `approve-pending-practice` and `approve-pending-rep` should ideally call `assign-user-role` instead of duplicating creation logic.
9. **Make email URLs environment-aware** - Use `SUPABASE_URL` or a new env var for app domain.
10. **Delete `sessionValidator.ts`** - Dead code.
11. **Fix bootstrap cache 2FA bypass** (M3) - Don't set `twoFAStatusChecked: true` from cache without checking actual 2FA localStorage state.

### Phase 4: Observability + Regression

12. **Add email delivery monitoring** - Query `audit_logs` for `email_*` action types to build visibility into email success/failure rates.
13. **Add alerting for partial user creation** - Monitor for auth users without corresponding `user_roles` entries.
14. **Add integration tests** for all 7 creation paths covering happy path + email failure scenarios.

---

## H. Regression Test Checklist

### Manual Tests
- [ ] Self-signup as doctor with valid NPI → verification email received → verify → login → 2FA → terms → dashboard
- [ ] Self-signup as pharmacy → verification email → verify → login
- [ ] Self-signup as topline → verification email → verify → login
- [ ] Admin creates doctor → welcome email received → click "Set Password" → set password → auto-login → 2FA → terms → dashboard
- [ ] Admin creates provider → welcome email → password setup → login
- [ ] Admin creates staff → welcome email → password setup → login → sees correct practice
- [ ] Admin creates pharmacy staff → welcome email → password setup → login
- [ ] Affiliate submits practice → admin approves → welcome email → password setup → login
- [ ] Rep request → admin approves → welcome email → password setup → login
- [ ] Create patient portal account → welcome email → password setup → login as patient
- [ ] Forgot password → reset email → click link → set new password → auto-login
- [ ] Login with expired session → redirect to /auth
- [ ] Login with disabled account → proper error message
- [ ] Login with unverified email → verification reminder shown
- [ ] Login with temp password → redirect to change-password
- [ ] Click expired verification link → proper error
- [ ] Click used verification link → proper error
- [ ] Click expired password reset link → proper error
- [ ] Resend verification email from reminder screen
- [ ] Resend welcome email from admin account details

### Edge Cases
- [ ] Double-submit signup form → only one user created
- [ ] Browser refresh during password setup → state preserved
- [ ] Open password reset link in different browser → works (token-based, no session needed)
- [ ] Admin creates user while impersonating → proper handling
- [ ] Multiple tabs with same user → session consistency

---

## Bottom-Line Verdict

**Is VitaLuxe signup/access safe for production at scale?**

**Conditionally YES** — at the current user count, the system works. At scale (>1000 users), the `listUsers()` pagination bug (C1, C2, C3) will cause real failures. This is the most important fix.

**What still needs cleanup even though it's functioning:**
- `approve-pending-rep` raw `fetch()` email call (H1)
- Temporary passwords in API responses (H3, H5)
- Hardcoded production URLs in all email templates (M6-M8)
- Auto-login bypass of account status checks (M9)
- Inconsistent email invocation patterns across creation paths

**Single biggest risk:** The `listUsers()` without pagination in `assign-user-role` — once you exceed 1000 auth users, the duplicate email check silently stops working and duplicate accounts can be created.

**Most likely intermittent bug source:** Frontend welcome email calls for staff/pharmacy staff (H2) — if the edge function is slow or returns an error, the user is created but never notified. This is the most likely source of "user says they never got an email" reports.

**Most dangerous silent failure:** The bootstrap cache fallback setting `twoFAStatusChecked: true` without actual verification (M3) — in a slow network scenario, a user could bypass 2FA enforcement entirely. This is low probability but high impact for a HIPAA-sensitive platform.

