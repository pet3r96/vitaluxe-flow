

# Complete Application Audit: Signup through Subscription Lifecycle

## Audit Scope
Full end-to-end audit covering: Practice signup, email verification, login, terms acceptance, adding staff/providers, ordering, messaging, patient account creation, VitaLuxePro trial signup, subscription management, cancellation, and all pages/tabs.

---

## Findings Summary

| # | Severity | Area | Issue |
|---|----------|------|-------|
| 1 | **CRITICAL** | Subscription Edge Function | `subscribe-to-vitaluxepro` uses wrong column name `terms_version` (should be `version`) when inserting into `user_terms_acceptances`, and missing `terms_id` field |
| 2 | **LOW** | Dead Code | `PatientTermsAccept()` helper in `table-helpers.ts` references non-existent `patient_terms_acceptances` table - unused but creates confusion |
| 3 | **LOW** | Dead Code | `PatientTermsAcceptance` type in `manual-schema.ts` is orphaned |
| 4 | **INFO** | Auth Performance | Bootstrap timeout reduced to 2000ms (line 243) but warning message still says "8s" |

---

## Detailed Findings

### 1. CRITICAL: `subscribe-to-vitaluxepro` Edge Function - Wrong Column Name

**File:** `supabase/functions/subscribe-to-vitaluxepro/index.ts` (lines 247-253)

The subscription terms acceptance insert uses `terms_version` as the column name:

```text
await supabaseAdmin.from('user_terms_acceptances').insert({
  user_id: practiceId,
  role: 'subscription',
  terms_version: subscriptionTerms.version,  // WRONG column name
  signature_name: actorEmail,                // WRONG column - doesn't exist
  accepted_at: new Date().toISOString(),
  // MISSING: terms_id (needed for unique index)
});
```

**Actual columns:** `id, user_id, terms_id, role, version, accepted_at, ip_address, user_agent, pdf_url, created_at`

**Problems:**
- `terms_version` should be `version`
- `signature_name` column does not exist in the table
- `terms_id` is missing (nullable but needed for the unique index `(user_id, terms_id)`)

**Impact:** This insert silently fails or inserts with wrong data when a practice starts a trial. The subscription terms acceptance record may not be properly created.

**Fix:** Update the insert to use correct column names:

```typescript
await supabaseAdmin.from('user_terms_acceptances').insert({
  user_id: practiceId,
  terms_id: subscriptionTerms.id,
  role: 'subscription',
  version: subscriptionTerms.version,
  accepted_at: new Date().toISOString(),
});
```

### 2. LOW: Dead Code - `PatientTermsAccept()` Helper

**File:** `src/integrations/supabase/table-helpers.ts` (line 61)

The `PatientTermsAccept()` function references `patient_terms_acceptances` table which does not exist in the database. No code currently calls this function (the last reference in `SignedAgreementSection.tsx` was removed in the previous fix), but it should be cleaned up to prevent future confusion.

**Fix:** Remove line 61 and the corresponding import of `PatientTermsAcceptance` from `manual-schema.ts`.

### 3. LOW: Dead Code - `PatientTermsAcceptance` Type

**File:** `src/types/manual-schema.ts` (line 188)

The `PatientTermsAcceptance` interface is orphaned after the `PatientTermsAccept()` cleanup.

**Fix:** Remove the interface definition.

### 4. INFO: Misleading Log Message

**File:** `src/contexts/AuthContext.tsx` (line 203)

The log message says "Auth bootstrap timeout (8s)" but the actual timeout is 2000ms (line 243).

**Fix:** Update log message to match actual timeout value.

---

## Flows Verified as Correct

### Signup Flow (Practice + Pharmacy)
- SignupForm correctly collects role-specific fields (provider name, NPI, DEA for practices; states serviced for pharmacies)
- `authService.signupUser()` calls `assign-user-role` edge function with `isSelfSignup: true`
- Password strength validation via `validatePasswordStrength()` before submission
- Email uniqueness check before signup attempt
- Verification email sent via `send-verification-email` edge function
- Full-screen verification message shown after successful signup

### Email Verification
- `/verify-email?token=xxx` route correctly calls `authService.verifyEmail()`
- Handles success and error states with appropriate UI
- Redirects to login after successful verification

### Login Flow
- `authService.loginUser()` checks: email/password -> account active status -> patient account status -> pending verification -> temp password flag
- Failed login tracking via `track-failed-login` edge function
- Unverified email shows full-screen reminder with resend option
- Temp password redirects to `/change-password`
- Disabled accounts show appropriate error

### Terms Acceptance
- `ProtectedRoute` correctly redirects to `/accept-terms` if `termsAccepted === false` and role is not admin
- 5-minute session grace period prevents redirect loops after accepting
- `AcceptTerms` page: scroll-to-bottom enforcement, checkbox, signature name, admin impersonation support
- `generate-terms-pdf`: creates PDF, uploads to storage, upserts into `user_terms_acceptances` with correct `onConflict: 'user_id,terms_id'`
- All roles (including patients) use unified `user_terms_acceptances` table
- `admin-get-password-status` correctly derives `terms_accepted` from `user_terms_acceptances` existence

### 2FA Flow
- System-wide enforcement check via `system_settings`
- Enrollment check via `user_2fa_settings_decrypted`
- Session-scoped verification via localStorage with hard session expiry tie-in
- `Global2FADialogs` renders setup/verify dialogs
- `ProtectedRoute` blocks access while 2FA is pending

### Auth Context / Session Management
- 60-minute hard session timeout with 15-minute refresh threshold
- 2-hour maximum session cap
- 30-minute inactivity timeout
- Activity-based extension (mousedown, keydown, scroll, touchstart)
- Cross-tab session expiry detection via `storage` event
- Tab visibility/focus checks
- Aggressive pre-login cleanup of old session data

### Adding Staff
- `/staff` route wrapped in `SubscriptionProtectedRoute` + `ProGate` (requires VitaLuxePro subscription)
- Access restricted to practice owners (`effectiveRole === 'doctor'` and not provider/staff accounts)
- `StaffDataTable` component handles CRUD

### Adding Providers
- `/providers` accessible to doctors and staff (not provider accounts)
- `ProvidersDataTable` handles CRUD
- RX privilege alerts (no providers, no NPI, success states)

### Ordering
- `/orders` renders `OrdersDataTable` + `OrderStatistics`
- Success banner from checkout redirect
- Cart -> Checkout -> Order confirmation flow

### Messaging
- `/messages` redirects based on role: reps to support-tickets, patients to patient-messages, others to support-tickets
- Internal chat for practices (subscription-protected)

### Patient Account Creation
- `create-patient-portal-account` edge function invoked from `PatientsDataTable`, `PracticePatients`, and `CreatePatientMessageDialog`

### VitaLuxePro Subscription
- Auto-enrollment in 14-day trial on first practice login (in AuthContext SIGNED_IN handler)
- `/subscribe-to-vitaluxepro` page: role-based redirects (pharmacy, staff, provider blocked)
- Trial expired dialog with upgrade/decline options
- `SubscriptionProtectedRoute` redirects unsubscribed doctors to subscribe page
- `ProGate` shows upgrade UI inline for unsubscribed doctors

### Subscription Cancellation
- `cancel-subscription` edge function: validates auth, checks existing subscription, updates status to 'cancelled', logs to `subscription_cancellations` and `audit_logs`

### Subscription Context
- Auto-grants access for patient/pharmacy/provider roles
- Realtime subscription change detection
- Edge function fallback for impersonation scenarios

### Profile / Signed Agreement
- `SignedAgreementSection` now correctly queries `user_terms_acceptances` for all roles (fixed in previous edit)

---

## Implementation Plan

1. **Fix `subscribe-to-vitaluxepro` edge function** - correct the column names and add `terms_id` to the subscription terms insert
2. **Remove dead code** - clean up `PatientTermsAccept()` from table-helpers and `PatientTermsAcceptance` type from manual-schema
3. **Fix misleading log message** - update bootstrap timeout warning to reflect actual 2s timeout

