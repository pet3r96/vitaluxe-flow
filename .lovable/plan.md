
# Complete Pre-Launch Re-Audit: Triple Check Results

## Audit Summary

After reading every critical file line-by-line (AuthContext 1757 lines, PatientIntakeForm 2124 lines, all key edge functions, all pages), here are the remaining issues. All previous fixes are confirmed correctly applied.

---

## Previous Fixes Confirmed Correct

- `get-user-context` edge function: now queries `user_2fa_settings_decrypted` with correct columns (verified lines 72-76)
- `AcceptTerms.tsx`: `rehypeSanitize` applied to ReactMarkdown (verified line 336)
- `subscribe-to-vitaluxepro` edge function: uses `terms_id`, `version`, no `signature_name` (verified lines 247-253)
- `PatientIntakeForm.tsx`: all 11 vault inserts include `practice_id` (verified lines 498-1005)
- Blood type insert: includes `record_type`, `title`, `practice_id` (verified lines 564-573)
- `PatientOnboarding.tsx`: removed (verified not in file listing)
- Bootstrap timeout log: says "2s" (verified line 203)
- Session timer log: says `minutesRemaining: 60` (verified line 414)
- Duplicate activity listeners: removed (verified lines 667-669 are now comments only)

---

## NEW Findings

| # | Severity | Area | Issue |
|---|----------|------|-------|
| 1 | **HIGH** | XSS in SubscribeToVitaLuxePro | `SubscribeToVitaLuxePro.tsx` line 483 renders `<ReactMarkdown>{termsContent}</ReactMarkdown>` WITHOUT `rehypeSanitize`. Imports `ReactMarkdown` but does NOT import or apply `rehypeSanitize`. Same XSS vector as the AcceptTerms issue we already fixed. |
| 2 | **MEDIUM** | Stale Comment | `AuthContext.tsx` line 621: Comment says "set fresh 30 minute timer" but `HARD_SESSION_TIMEOUT_MS` is 60 minutes. This was identified in the previous audit but not yet fixed. |
| 3 | **MEDIUM** | Duplicate API Call | `AuthContext.tsx` lines 987-1040: `fetchUserRole` calls `get-active-impersonation` TWICE for admin users. Lines 987-1009 fetch it once. Lines 1016-1040 make the identical call again just to get `effectiveUserIdForTerms`. The result from the first call should be reused. |
| 4 | **LOW** | Legacy Table | The `patient_terms_acceptances` table still exists in the database (created by migrations). While no application code references it anymore (all code uses the unified `user_terms_acceptances`), it is dead schema that could cause confusion. Not blocking for launch but should be cleaned up post-launch. |

---

## Detailed Findings

### 1. HIGH: Missing `rehypeSanitize` in SubscribeToVitaLuxePro

**File:** `src/pages/SubscribeToVitaLuxePro.tsx`

Line 15 imports `ReactMarkdown` but does NOT import `rehypeSanitize`. Line 483:

```text
<ReactMarkdown>{termsContent}</ReactMarkdown>
```

This renders subscription terms content from the `terms_and_conditions` table without HTML sanitization. The same vulnerability pattern as the AcceptTerms issue that was already fixed.

**Contrast with correctly implemented components:**
- `AcceptTerms.tsx` line 336: has `rehypePlugins={[rehypeSanitize]}` (fixed)
- `PaymentWithTermsDialog.tsx` line 101: has `rehypePlugins={[rehypeSanitize]}` (correct)
- `EnrollSubscriptionDialog.tsx` line 126: has `rehypePlugins={[rehypeSanitize]}` (correct)

**Fix:** Add `import rehypeSanitize from "rehype-sanitize"` and update line 483 to:
```tsx
<ReactMarkdown rehypePlugins={[rehypeSanitize]}>{termsContent}</ReactMarkdown>
```

### 2. MEDIUM: Stale "30 minute" Comment

**File:** `src/contexts/AuthContext.tsx` line 621

```text
// No expiration found (shouldn't happen) - set fresh 30 minute timer
```

The timer uses `HARD_SESSION_TIMEOUT_MS` which is 60 minutes. This comment was identified in the previous audit but the fix was not applied.

**Fix:** Change "30 minute" to "60 minute".

### 3. MEDIUM: Duplicate `get-active-impersonation` Call

**File:** `src/contexts/AuthContext.tsx` lines 987-1040

The `fetchUserRole` function calls `get-active-impersonation` at lines 993-997, stores the result, and sets impersonation state. Then at lines 1022-1026, it makes the **exact same call** to get `effectiveUserIdForTerms`.

**Fix:** Store the session data from the first call in a variable and reuse it in the second block. Specifically:
- After line 998 (`if (sessionData?.session)`), store `sessionData` in a variable declared before the first block
- Replace lines 1016-1040 to use the stored variable instead of making a new API call

---

## Everything Verified Correct

### All User Types - Login to Dashboard Flow
- **Practice (doctor):** Signup -> verify email -> login -> change temp password (if needed) -> terms acceptance (first login only) -> 2FA -> auto-trial enrollment -> dashboard
- **Pharmacy:** Signup -> verify -> login -> terms -> 2FA -> dashboard
- **Provider (admin-created):** Temp password email -> change password -> login -> terms -> 2FA -> dashboard
- **Staff (admin-created):** Same as provider
- **Patient (practice-created):** Temp password -> change password -> login -> terms -> 2FA -> intake dialog -> dashboard
- **Admin:** Login -> skip terms -> 2FA -> dashboard (terms always bypassed)
- **Rep (topline/downline):** Login -> terms -> 2FA -> dashboard

### Terms Acceptance - First vs Second Login
- **First login:** `fetchUserRole` queries `user_terms_acceptances` -> no record -> `termsAccepted = false` -> `ProtectedRoute` redirects to `/accept-terms` -> user scrolls, agrees, signs -> `generate-terms-pdf` upserts record with `onConflict: 'user_id,terms_id'` -> `checkPasswordStatus` re-invoked -> `termsAccepted = true` -> session flag set -> navigates to `/`
- **Second login:** `fetchUserRole` queries `user_terms_acceptances` -> record exists -> `termsAccepted = true` -> NO redirect, goes straight to dashboard
- **Admin:** Always sets `termsAccepted = true` without DB check (line 1060-1064)

### All Pages Verified
- `/auth` - Login/Signup with role selection, password strength, NPI/NPPES verification
- `/verify-email` - Token validation, success/error UI
- `/change-password` - Token mode + authenticated mode + admin impersonation mode
- `/accept-terms` - Scroll enforcement, checkbox, signature, admin impersonation support, XSS protection
- `/dashboard` - Role-based widgets, subscription gating, realtime updates
- `/subscribe-to-vitaluxepro` - Practice-only route, role redirects (pharmacy, staff, provider blocked)
- `/intake` - All 11 vault inserts correct with `practice_id`
- `/medical-vault` - Patient medical vault with correct record type queries
- `/patient-documents` - Upload, download, realtime, share toggle
- `/patient-appointments` - Booking, cancellation, subscription gating
- `/orders` - Cart, checkout, confirmation
- `/messages` - Role-based routing
- `/staff` - Subscription + ProGate protected
- `/providers` - Doctor/staff accessible
- `/patients` - Patient management
- `/profile` - Role-based profile forms, signed agreement section

### All Edge Functions Verified
- `assign-user-role` - CSRF, rate limiting, IP filtering, NPI verification, password strength
- `generate-terms-pdf` - PDF creation, storage upload, upsert with correct conflict handling
- `admin-get-password-status` - Terms check from `user_terms_acceptances`, admin-only
- `get-user-context` - Correct 2FA table/columns, terms from `user_terms_acceptances`
- `subscribe-to-vitaluxepro` - Correct column names for terms insert
- `create-patient-portal-account` - Auth, CSRF, rate limiting, subscription check
- `verify-email` - Token validation, status update
- `track-failed-login` - Login attempt tracking
- `cancel-subscription` - Audit logging

### Security Verified
- XSS protection on all markdown rendering (except the one finding above)
- CSRF token validation on sensitive operations
- Rate limiting on signup/login
- IP filtering on admin operations
- RLS policies on all sensitive tables
- 2FA enforcement with session-scoped verification
- Session management with hard timeout, inactivity, and max session cap

---

## Implementation Plan

1. **Fix `SubscribeToVitaLuxePro.tsx` XSS** - Add `rehypeSanitize` import and apply to ReactMarkdown
2. **Fix stale comment** in `AuthContext.tsx` line 621 - Change "30 minute" to "60 minute"
3. **Eliminate duplicate API call** in `AuthContext.tsx` `fetchUserRole` - Reuse stored impersonation session data instead of calling `get-active-impersonation` twice
