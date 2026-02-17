
# Complete Pre-Launch Audit: All User Roles, All Functions, All Pages

## Audit Scope
Every flow from signup through re-login for all roles (practice, pharmacy, provider, staff, patient, admin, topline, downline). Every page, every function, every edge function, every security boundary.

---

## Findings Summary

| # | Severity | Area | Issue |
|---|----------|------|-------|
| 1 | **CRITICAL** | `get-user-context` Edge Function | Queries non-existent `user_2fa` table (line 73). Only `user_2fa_settings` and `user_2fa_settings_decrypted` exist in the database. This causes a silent failure in the 2FA status check within this edge function. |
| 2 | **HIGH** | Terms XSS Risk | `AcceptTerms.tsx` imports `rehypeSanitize` (line 17) but never applies it to `ReactMarkdown` (line 336). Terms content rendered without HTML sanitization. If an admin inserts malicious markdown/HTML in terms content, it executes in every user's browser. |
| 3 | **MEDIUM** | Session Timer Logs | `AuthContext.tsx` line 382 comment says "30 minutes from now" and line 414 logs `minutesRemaining: 30`, but `HARD_SESSION_TIMEOUT_MS` is 60 minutes (line 90). Misleading for debugging. |
| 4 | **LOW** | Duplicate Activity Listeners | `AuthContext.tsx` registers activity event listeners twice: once in the main `useEffect` (lines 321-330) and again in a separate `useEffect` (lines 668-727). Both listen on `mousedown`, `keydown`, `scroll`, `touchstart` -- doubling event processing. |

---

## Detailed Findings

### 1. CRITICAL: `get-user-context` Queries Non-Existent `user_2fa` Table

**File:** `supabase/functions/get-user-context/index.ts` (lines 71-76)

```text
supabase
  .from('user_2fa')
  .select('setup_complete, verified')
  .eq('user_id', userId)
```

The table `user_2fa` does not exist in the database. Only `user_2fa_settings` and `user_2fa_settings_decrypted` exist. The columns `setup_complete` and `verified` also don't match the actual schema which uses `is_enrolled`, `twilio_enabled`, `ghl_enabled`, `phone_verified`.

**Impact:** This query always fails silently (via `Promise.allSettled`), causing the 2FA status to always return `{ setupComplete: false, verified: false }` from this endpoint. However, the main AuthContext doesn't use this endpoint for 2FA -- it directly queries `user_2fa_settings_decrypted` (line 129). So the impact is limited to any future code that relies on `get-user-context` for 2FA status.

**Fix:** Update the query to use `user_2fa_settings_decrypted` with correct column names:
- Replace `from('user_2fa')` with `from('user_2fa_settings_decrypted')`
- Replace `select('setup_complete, verified')` with `select('is_enrolled, twilio_enabled, ghl_enabled, phone_verified')`
- Update the response processing logic accordingly

### 2. HIGH: Unsanitized Markdown in AcceptTerms

**File:** `src/pages/AcceptTerms.tsx`

Line 17 imports `rehypeSanitize` but line 336 renders:
```text
<ReactMarkdown>{terms.content}</ReactMarkdown>
```

Without `rehypePlugins={[rehypeSanitize]}`. This means any HTML in the terms markdown content will be rendered unsanitized.

**Risk:** While terms content is admin-controlled (stored in `terms_and_conditions` table), a compromised admin account could inject `<script>` tags or other XSS vectors that would execute in every user's browser when they view the terms page.

**Fix:** Add the sanitization plugin:
```tsx
<ReactMarkdown rehypePlugins={[rehypeSanitize]}>{terms.content}</ReactMarkdown>
```

### 3. MEDIUM: Misleading Session Timer Log Messages

**File:** `src/contexts/AuthContext.tsx`

- Line 90: `HARD_SESSION_TIMEOUT_MS = 60 * 60 * 1000` (60 minutes)
- Line 382: Comment says `// Set hard session expiration (30 minutes from now)` -- should say 60 minutes
- Line 414: Log says `minutesRemaining: 30` -- should be `minutesRemaining: 60`

**Fix:** Update both the comment and the log value to 60.

### 4. LOW: Duplicate Activity Event Listeners

**File:** `src/contexts/AuthContext.tsx`

Two separate `useEffect` hooks register identical event listeners:
- Lines 321-330: Registers `mousedown`, `keydown`, `scroll`, `touchstart` with `handleActivity` for session extension
- Lines 668-727: Registers the same events with a different `handleActivity` that calls `supabase.auth.refreshSession()`

Both fire on every user interaction. The first extends the localStorage-based session timer. The second refreshes the actual Supabase auth token. While both are needed functionally, having two sets of listeners for the same events is inefficient and confusing.

**Fix:** Consolidate into a single set of listeners that handles both session extension and token refresh logic.

---

## Flows Verified as Correct (No Issues Found)

### Practice (Doctor) Signup Flow
- `Auth.tsx` collects Provider Full Name, Prescriber Name, License Number, NPI, DEA, company, phone, address
- Password strength validation (client + server)
- `authService.signupUser()` -> `assign-user-role` edge function with `isSelfSignup: true`
- Email normalization, duplicate check, NPI NPPES verification
- `create_user_with_role` RPC creates profile + role atomically
- Status set to `pending_verification`, verification email sent
- Full-screen verification message shown

### Pharmacy Signup Flow
- Collects Contact Email and States Serviced
- Same secure path through `assign-user-role`
- Proper validation for required pharmacy fields

### Email Verification
- `/verify-email?token=xxx` -> `authService.verifyEmail()` -> `verify-email` edge function
- Token validated, status updated to `active`
- Success/error states handled with clear UI

### Login Flow (All Roles)
- `authService.loginUser()`: email/password sign-in -> profile status check -> patient disabled check -> pending verification check -> temp password check
- Failed login tracking via `track-failed-login`
- Unverified email shows full-screen reminder with resend option
- Temp password redirects to `/change-password?email=...`
- Disabled accounts show appropriate error
- Account lockout system in place

### Terms Acceptance (First Login Only)
- `ProtectedRoute` checks `termsAccepted` from `user_terms_acceptances` table
- Redirects to `/accept-terms` only if no record exists (first login)
- 5-minute session grace period prevents redirect loops after accepting
- `AcceptTerms.tsx`: scroll-to-bottom enforcement, checkbox, signature, admin impersonation support
- `generate-terms-pdf`: creates PDF, uploads to storage, upserts with `onConflict: 'user_id,terms_id'`
- After acceptance, `checkPasswordStatus` is re-invoked to update state
- Subsequent logins: record exists in `user_terms_acceptances` -> `termsAccepted = true` -> no redirect
- Admin bypass: admins skip terms entirely (unless impersonating)

### Password Change (Temp Password)
- Token-based flow: `validate-password-token` -> token verified -> password changed via `reset-password-with-token`
- Authenticated flow: current password required -> Supabase `updateUser` called
- `temp_password` flag cleared after change
- Impersonation support for admin-initiated resets

### 2FA Flow (SMS via Twilio)
- System-wide enforcement check via `system_settings`
- Enrollment check via `user_2fa_settings_decrypted`
- Session-scoped verification stored in localStorage tied to session expiry
- `Global2FADialogs` renders setup/verify dialog at app root
- `ProtectedRoute` blocks content while 2FA pending
- 2FA re-required on every new login (localStorage key cleared on sign-out)

### Session Management
- 60-minute hard timeout with activity refresh
- 30-minute inactivity timeout
- 2-hour maximum session cap
- Cross-tab session detection via `storage` event
- Tab visibility/focus checks
- Pre-login cleanup of stale session data

### Admin Creates User (Provider, Staff, Rep, Practice)
- `authService.createUserByAdmin()` -> `assign-user-role` with `isAdminCreated: true`
- Auto-confirms email, generates temp password
- Welcome email with password reset link sent
- CSRF validation, rate limiting, IP filtering all active
- Atomic user creation via `create_user_with_role` RPC

### Adding Providers (Practice)
- `/providers` accessible to doctors and staff
- NPI/DEA validation, NPPES registry check
- Provider record linked to practice via `practice_id`
- Address synced from practice to provider

### Adding Staff (Practice)
- `/staff` behind `SubscriptionProtectedRoute` + `ProGate`
- Only practice owners can manage staff
- Staff linked to practice via `practice_staff` table

### Patient Portal Account Creation
- `create-patient-portal-account`: validates auth, CSRF, rate limiting, subscription check
- Creates auth user, assigns patient role, links to `patient_accounts`
- Temp password token generated, welcome email sent
- Handles re-invites for existing patients

### Patient Intake Form
- All 11 `patient_medical_vault` insert locations now include `practice_id` (fixed in previous commit)
- Blood type insert fixed with proper `record_type`, `title`, `practice_id`
- Demographics saved to `patient_accounts`
- `intake_completed_at` timestamp set on completion
- `GlobalIntakeDialog` prompts patients who haven't completed intake

### Patient Medical Vault
- Queries by `patient_account_id` and `record_type`
- All sections (medications, conditions, allergies, vitals, immunizations, surgeries, pharmacies, emergency contacts) work correctly
- PDF generation, audit logs, print functionality all present

### Patient Documents
- Upload to `patient-documents` bucket
- Correct `patient_medical_vault` insert with `record_type: 'document'`
- Download via `manage-documents` edge function with signed URLs
- Realtime subscriptions for new documents
- Document visibility (share_with_practice toggle)

### Patient Appointments
- Booking via `book-appointment` edge function
- Availability check, cancellation, reschedule all present
- Subscription gating when practice subscription lapses
- Calendar export via `export-calendar-ics`

### Ordering Flow
- Cart management via `manage-cart` edge function
- Checkout with payment via Authorize.net
- Order placement via `place-order`
- Order confirmation, delivery confirmation pages
- Pharmacy routing via `route-order-to-pharmacy`

### Messaging
- Role-based routing: reps to support-tickets, patients to patient-messages, others to support-tickets
- Internal chat for practices (subscription-protected)
- Patient messaging via `send-patient-message`

### VitaLuxePro Subscription
- Auto-enrollment in 14-day trial on first practice login
- Subscription terms insert now uses correct columns (fixed in previous commit)
- `SubscriptionProtectedRoute` redirects unsubscribed doctors
- Trial expiry dialog with upgrade/decline
- Payment processing via `process-subscription-payment`
- Cancellation via `cancel-subscription` with audit logging

### Subscription Context
- Auto-grants access for patient/pharmacy/provider roles
- Realtime subscription change detection
- Edge function fallback for impersonation

### Profile / Signed Agreement
- `SignedAgreementSection` correctly queries `user_terms_acceptances` for all roles (fixed previously)

### Impersonation
- Server-side session management via `active_impersonation_sessions`
- CSRF validation, admin authorization check
- Session restored on page reload
- Proper cleanup on end/timeout/sign-out

### Security Pages
- Admin security dashboard with practice status, audit logs
- Penetration test edge functions for RLS, JWT, storage, edge functions

---

## Implementation Plan

### Fix 1: Update `get-user-context` edge function (CRITICAL)
Update the 2FA query from non-existent `user_2fa` table to `user_2fa_settings_decrypted` with correct column names. Update response processing to match the actual schema.

### Fix 2: Add `rehypeSanitize` to AcceptTerms ReactMarkdown (HIGH)
Add `rehypePlugins={[rehypeSanitize]}` to the `<ReactMarkdown>` component in `AcceptTerms.tsx` to prevent XSS via admin-controlled terms content.

### Fix 3: Fix misleading session timer logs (MEDIUM)
Update the comment on line 382 and log on line 414 to say 60 minutes instead of 30.

### Fix 4: Consolidate duplicate activity listeners (LOW)
Remove the duplicate event listener registration in the second `useEffect` (lines 668-727) and merge its token refresh logic into the first listener.
